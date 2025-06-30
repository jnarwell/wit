/**
 * @file voice_core.c
 * @brief W.I.T. Voice Processing Core Implementation
 */

#include "voice_core.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include "FreeRTOS.h"
#include "task.h"
#include "semphr.h"
#include "timers.h"

/* Internal Constants */
#define CIRCULAR_BUFFER_SIZE    (VOICE_BUFFER_SIZE * VOICE_CHANNELS * sizeof(int16_t))
#define FFT_SIZE                512
#define MEL_FILTERS             40
#define MFCC_COEFFICIENTS       13

/* Voice Context Structure */
struct voice_context {
    /* Configuration */
    voice_config_t config;
    voice_state_t state;
    
    /* Audio Buffers */
    int16_t* circular_buffer;
    size_t buffer_write_idx;
    size_t buffer_read_idx;
    SemaphoreHandle_t buffer_mutex;
    
    /* Recording Buffer */
    uint8_t* recording_buffer;
    size_t recording_size;
    size_t recording_capacity;
    bool is_recording;
    uint32_t recording_start_time;
    uint32_t max_recording_duration;
    
    /* Beamforming */
    float* beamform_weights;
    float* beamform_delays;
    float current_steering_angle;
    
    /* Wake Word Detection */
    void* wake_word_engine;
    uint32_t last_wake_time;
    float wake_sensitivity;
    
    /* Voice Activity Detection */
    float noise_floor;
    float* energy_history;
    uint32_t vad_frame_count;
    bool vad_active;
    
    /* DSP Buffers */
    float* fft_buffer;
    float* mel_energies;
    float* mfcc_features;
    
    /* Statistics */
    voice_stats_t stats;
    uint32_t start_time;
    
    /* Callbacks */
    voice_audio_callback_t audio_callback;
    void* audio_callback_data;
    
    /* Synchronization */
    TaskHandle_t processing_task;
    QueueHandle_t frame_queue;
    TimerHandle_t timeout_timer;
};

/* Forward Declarations */
static void voice_processing_task(void* param);
static void voice_timeout_callback(TimerHandle_t timer);
static float calculate_energy_db(const int16_t* samples, size_t num_samples);
static bool detect_voice_activity(voice_context_t* ctx, const voice_frame_t* frame);
static void apply_beamforming(voice_context_t* ctx, voice_frame_t* frame);
static void process_wake_word_detection(voice_context_t* ctx, const voice_frame_t* frame);
static void update_noise_floor(voice_context_t* ctx, float current_energy);

/* Initialize voice processing system */
voice_context_t* voice_init(const voice_config_t* config) {
    if (!config) {
        return NULL;
    }
    
    /* Allocate context */
    voice_context_t* ctx = (voice_context_t*)pvPortMalloc(sizeof(voice_context_t));
    if (!ctx) {
        return NULL;
    }
    
    memset(ctx, 0, sizeof(voice_context_t));
    memcpy(&ctx->config, config, sizeof(voice_config_t));
    
    /* Initialize state */
    ctx->state = VOICE_STATE_IDLE;
    ctx->wake_sensitivity = WAKE_WORD_SENSITIVITY;
    ctx->noise_floor = VAD_ENERGY_THRESHOLD;
    ctx->start_time = xTaskGetTickCount() * portTICK_PERIOD_MS;
    
    /* Allocate circular buffer */
    ctx->circular_buffer = (int16_t*)pvPortMalloc(CIRCULAR_BUFFER_SIZE);
    if (!ctx->circular_buffer) {
        goto error_cleanup;
    }
    memset(ctx->circular_buffer, 0, CIRCULAR_BUFFER_SIZE);
    
    /* Allocate recording buffer (start with 10 seconds capacity) */
    ctx->recording_capacity = VOICE_SAMPLE_RATE * 10 * sizeof(int16_t);
    ctx->recording_buffer = (uint8_t*)pvPortMalloc(ctx->recording_capacity);
    if (!ctx->recording_buffer) {
        goto error_cleanup;
    }
    
    /* Allocate beamforming arrays */
    ctx->beamform_weights = (float*)pvPortMalloc(VOICE_CHANNELS * sizeof(float));
    ctx->beamform_delays = (float*)pvPortMalloc(VOICE_CHANNELS * sizeof(float));
    if (!ctx->beamform_weights || !ctx->beamform_delays) {
        goto error_cleanup;
    }
    
    /* Initialize beamforming weights */
    for (int i = 0; i < VOICE_CHANNELS; i++) {
        ctx->beamform_weights[i] = 1.0f / VOICE_CHANNELS;
        ctx->beamform_delays[i] = 0.0f;
    }
    
    /* Allocate VAD history buffer */
    ctx->energy_history = (float*)pvPortMalloc(10 * sizeof(float));
    if (!ctx->energy_history) {
        goto error_cleanup;
    }
    
    /* Allocate DSP buffers */
    ctx->fft_buffer = (float*)pvPortMalloc(FFT_SIZE * sizeof(float));
    ctx->mel_energies = (float*)pvPortMalloc(MEL_FILTERS * sizeof(float));
    ctx->mfcc_features = (float*)pvPortMalloc(MFCC_COEFFICIENTS * sizeof(float));
    if (!ctx->fft_buffer || !ctx->mel_energies || !ctx->mfcc_features) {
        goto error_cleanup;
    }
    
    /* Create synchronization objects */
    ctx->buffer_mutex = xSemaphoreCreateMutex();
    ctx->frame_queue = xQueueCreate(10, sizeof(voice_frame_t));
    if (!ctx->buffer_mutex || !ctx->frame_queue) {
        goto error_cleanup;
    }
    
    /* Create timeout timer */
    ctx->timeout_timer = xTimerCreate("VoiceTimeout", 
                                     pdMS_TO_TICKS(WAKE_WORD_TIMEOUT_MS),
                                     pdFALSE, ctx, voice_timeout_callback);
    if (!ctx->timeout_timer) {
        goto error_cleanup;
    }
    
    /* Create processing task */
    if (xTaskCreate(voice_processing_task, "VoiceProc", 
                   4096, ctx, tskIDLE_PRIORITY + 3, 
                   &ctx->processing_task) != pdPASS) {
        goto error_cleanup;
    }
    
    /* Initialize wake word engine (placeholder - would integrate real engine) */
    ctx->wake_word_engine = NULL; // Initialize with actual wake word engine
    
    return ctx;

error_cleanup:
    voice_deinit(ctx);
    return NULL;
}

/* Deinitialize voice processing system */
void voice_deinit(voice_context_t* ctx) {
    if (!ctx) return;
    
    /* Stop processing task */
    if (ctx->processing_task) {
        vTaskDelete(ctx->processing_task);
    }
    
    /* Delete timer */
    if (ctx->timeout_timer) {
        xTimerDelete(ctx->timeout_timer, 0);
    }
    
    /* Delete synchronization objects */
    if (ctx->buffer_mutex) {
        vSemaphoreDelete(ctx->buffer_mutex);
    }
    if (ctx->frame_queue) {
        vQueueDelete(ctx->frame_queue);
    }
    
    /* Free buffers */
    if (ctx->circular_buffer) vPortFree(ctx->circular_buffer);
    if (ctx->recording_buffer) vPortFree(ctx->recording_buffer);
    if (ctx->beamform_weights) vPortFree(ctx->beamform_weights);
    if (ctx->beamform_delays) vPortFree(ctx->beamform_delays);
    if (ctx->energy_history) vPortFree(ctx->energy_history);
    if (ctx->fft_buffer) vPortFree(ctx->fft_buffer);
    if (ctx->mel_energies) vPortFree(ctx->mel_energies);
    if (ctx->mfcc_features) vPortFree(ctx->mfcc_features);
    
    vPortFree(ctx);
}

/* Process audio frame */
voice_error_t voice_process_frame(voice_context_t* ctx, const voice_frame_t* frame) {
    if (!ctx || !frame) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    /* Send frame to processing queue */
    if (xQueueSend(ctx->frame_queue, frame, 0) != pdPASS) {
        ctx->stats.buffer_overruns++;
        return VOICE_ERR_BUFFER_OVERFLOW;
    }
    
    return VOICE_OK;
}

/* Voice processing task */
static void voice_processing_task(void* param) {
    voice_context_t* ctx = (voice_context_t*)param;
    voice_frame_t frame;
    
    while (1) {
        /* Wait for frame */
        if (xQueueReceive(ctx->frame_queue, &frame, portMAX_DELAY) == pdPASS) {
            /* Update statistics */
            ctx->stats.frames_processed++;
            
            /* Apply beamforming if enabled */
            if (ctx->config.beamform.adaptive_mode || 
                ctx->current_steering_angle != 0.0f) {
                apply_beamforming(ctx, &frame);
            }
            
            /* Detect voice activity */
            bool vad_result = detect_voice_activity(ctx, &frame);
            frame.vad_active = vad_result;
            
            if (vad_result) {
                ctx->stats.vad_activations++;
            }
            
            /* State machine */
            switch (ctx->state) {
                case VOICE_STATE_IDLE:
                case VOICE_STATE_LISTENING:
                    /* Check for wake word */
                    process_wake_word_detection(ctx, &frame);
                    break;
                    
                case VOICE_STATE_WAKE_DETECTED:
                    /* Automatically transition to recording */
                    ctx->state = VOICE_STATE_RECORDING;
                    ctx->recording_start_time = frame.timestamp_ms;
                    ctx->recording_size = 0;
                    ctx->is_recording = true;
                    /* Fall through to recording */
                    
                case VOICE_STATE_RECORDING:
                    /* Record audio if VAD active */
                    if (frame.vad_active && ctx->is_recording) {
                        /* Add frame to recording buffer */
                        size_t frame_bytes = VOICE_FRAME_SIZE * sizeof(int16_t);
                        if (ctx->recording_size + frame_bytes <= ctx->recording_capacity) {
                            /* Copy beamformed mono audio */
                            int16_t mono_frame[VOICE_FRAME_SIZE];
                            for (int i = 0; i < VOICE_FRAME_SIZE; i++) {
                                float sum = 0.0f;
                                for (int ch = 0; ch < VOICE_CHANNELS; ch++) {
                                    sum += frame.samples[i * VOICE_CHANNELS + ch] * 
                                           ctx->beamform_weights[ch];
                                }
                                mono_frame[i] = (int16_t)fminf(fmaxf(sum, -32768.0f), 32767.0f);
                            }
                            
                            memcpy(ctx->recording_buffer + ctx->recording_size,
                                   mono_frame, frame_bytes);
                            ctx->recording_size += frame_bytes;
                        }
                    }
                    
                    /* Check recording timeout */
                    if (frame.timestamp_ms - ctx->recording_start_time > 
                        ctx->max_recording_duration) {
                        voice_stop_recording(ctx);
                    }
                    break;
                    
                case VOICE_STATE_PROCESSING:
                    /* Wait for external processing to complete */
                    break;
                    
                case VOICE_STATE_ERROR:
                    /* Error state - might need reset */
                    break;
            }
            
            /* Invoke audio callback if registered */
            if (ctx->audio_callback) {
                ctx->audio_callback(frame.samples, VOICE_FRAME_SIZE,
                                   VOICE_CHANNELS, ctx->audio_callback_data);
            }
            
            /* Update circular buffer */
            if (xSemaphoreTake(ctx->buffer_mutex, pdMS_TO_TICKS(10)) == pdPASS) {
                size_t write_size = VOICE_FRAME_SIZE * VOICE_CHANNELS;
                memcpy(&ctx->circular_buffer[ctx->buffer_write_idx],
                       frame.samples, write_size * sizeof(int16_t));
                
                ctx->buffer_write_idx = (ctx->buffer_write_idx + write_size) %
                                       (VOICE_BUFFER_SIZE * VOICE_CHANNELS);
                
                xSemaphoreGive(ctx->buffer_mutex);
            }
        }
    }
}

/* Calculate energy in dB */
static float calculate_energy_db(const int16_t* samples, size_t num_samples) {
    if (!samples || num_samples == 0) {
        return -100.0f;
    }
    
    float sum = 0.0f;
    for (size_t i = 0; i < num_samples; i++) {
        float normalized = samples[i] / 32768.0f;
        sum += normalized * normalized;
    }
    
    float rms = sqrtf(sum / num_samples);
    return 20.0f * log10f(fmaxf(rms, 1e-6f));
}

/* Detect voice activity */
static bool detect_voice_activity(voice_context_t* ctx, const voice_frame_t* frame) {
    /* Calculate energy for each channel */
    float total_energy = 0.0f;
    int active_channels = 0;
    
    for (int ch = 0; ch < VOICE_CHANNELS; ch++) {
        /* Extract channel samples */
        int16_t channel_samples[VOICE_FRAME_SIZE];
        for (int i = 0; i < VOICE_FRAME_SIZE; i++) {
            channel_samples[i] = frame->samples[i * VOICE_CHANNELS + ch];
        }
        
        float energy = calculate_energy_db(channel_samples, VOICE_FRAME_SIZE);
        ((voice_frame_t*)frame)->energy_db[ch] = energy; // Cast away const for update
        
        if (energy > ctx->noise_floor + 6.0f) { // 6dB above noise floor
            active_channels++;
        }
        
        total_energy += energy;
    }
    
    float avg_energy = total_energy / VOICE_CHANNELS;
    ctx->stats.avg_energy_db = avg_energy;
    
    /* Update noise floor during silence */
    if (!ctx->vad_active) {
        update_noise_floor(ctx, avg_energy);
    }
    
    /* VAD decision based on energy and active channels */
    bool energy_vad = avg_energy > ctx->noise_floor + 10.0f;
    bool channel_vad = active_channels >= (VOICE_CHANNELS / 2);
    
    if (energy_vad && channel_vad) {
        ctx->vad_frame_count++;
    } else {
        ctx->vad_frame_count = 0;
    }
    
    /* Require multiple consecutive frames */
    ctx->vad_active = ctx->vad_frame_count >= VAD_FRAME_THRESHOLD;
    
    return ctx->vad_active;
}

/* Apply beamforming to frame */
static void apply_beamforming(voice_context_t* ctx, voice_frame_t* frame) {
    /* Simple delay-and-sum beamforming */
    float steering_rad = ctx->current_steering_angle * M_PI / 180.0f;
    float speed_of_sound = 343.0f; // m/s
    
    /* Calculate delays based on microphone positions */
    for (int ch = 0; ch < VOICE_CHANNELS; ch++) {
        float dx = ctx->config.beamform.mic_positions[ch][0];
        float dy = ctx->config.beamform.mic_positions[ch][1];
        
        /* Time delay in samples */
        float delay = (dx * cosf(steering_rad) + dy * sinf(steering_rad)) * 
                     VOICE_SAMPLE_RATE / speed_of_sound;
        ctx->beamform_delays[ch] = delay;
        
        /* Update weights based on coherence (simplified) */
        ctx->beamform_weights[ch] = 1.0f / VOICE_CHANNELS;
    }
    
    /* Note: Actual implementation would apply fractional delays */
    /* This is a placeholder for the concept */
}

/* Process wake word detection */
static void process_wake_word_detection(voice_context_t* ctx, const voice_frame_t* frame) {
    /* Placeholder for actual wake word detection */
    /* In real implementation, this would:
     * 1. Extract MFCC features from the frame
     * 2. Feed features to wake word model
     * 3. Check confidence against threshold
     */
    
    /* Simulate wake word detection (replace with real implementation) */
    static int simulation_counter = 0;
    simulation_counter++;
    
    /* For demo: trigger wake word every 500 frames if VAD active */
    if (frame->vad_active && (simulation_counter % 500) == 0) {
        /* Wake word detected */
        ctx->state = VOICE_STATE_WAKE_DETECTED;
        ctx->last_wake_time = frame->timestamp_ms;
        ctx->stats.wake_detections++;
        
        /* Start timeout timer */
        xTimerReset(ctx->timeout_timer, 0);
        
        /* Call wake word callback if registered */
        for (int i = 0; i < ctx->config.num_wake_words; i++) {
            if (ctx->config.wake_words[i].callback) {
                ctx->config.wake_words[i].callback();
                break;
            }
        }
    }
}

/* Update noise floor estimate */
static void update_noise_floor(voice_context_t* ctx, float current_energy) {
    /* Simple exponential moving average */
    float alpha = 0.95f; // Slow adaptation
    ctx->noise_floor = alpha * ctx->noise_floor + (1.0f - alpha) * current_energy;
    ctx->stats.noise_floor_db = ctx->noise_floor;
}

/* Timeout callback */
static void voice_timeout_callback(TimerHandle_t timer) {
    voice_context_t* ctx = (voice_context_t*)pvTimerGetTimerID(timer);
    if (ctx->state == VOICE_STATE_WAKE_DETECTED) {
        ctx->state = VOICE_STATE_IDLE;
    }
}

/* Get current state */
voice_state_t voice_get_state(const voice_context_t* ctx) {
    return ctx ? ctx->state : VOICE_STATE_ERROR;
}

/* Start recording */
voice_error_t voice_start_recording(voice_context_t* ctx, uint32_t max_duration_ms) {
    if (!ctx) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    if (ctx->state != VOICE_STATE_WAKE_DETECTED && 
        ctx->state != VOICE_STATE_IDLE) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    ctx->recording_size = 0;
    ctx->is_recording = true;
    ctx->max_recording_duration = max_duration_ms;
    ctx->recording_start_time = xTaskGetTickCount() * portTICK_PERIOD_MS;
    ctx->state = VOICE_STATE_RECORDING;
    
    return VOICE_OK;
}

/* Stop recording */
voice_error_t voice_stop_recording(voice_context_t* ctx) {
    if (!ctx) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    ctx->is_recording = false;
    ctx->state = VOICE_STATE_PROCESSING;
    
    return VOICE_OK;
}

/* Get recording data */
voice_error_t voice_get_recording(voice_context_t* ctx, uint8_t* buffer,
                                 size_t buffer_size, size_t* bytes_written) {
    if (!ctx || !buffer || !bytes_written) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    if (ctx->recording_size == 0) {
        *bytes_written = 0;
        return VOICE_OK;
    }
    
    size_t copy_size = (ctx->recording_size < buffer_size) ? 
                       ctx->recording_size : buffer_size;
    
    memcpy(buffer, ctx->recording_buffer, copy_size);
    *bytes_written = copy_size;
    
    /* Clear recording buffer */
    ctx->recording_size = 0;
    ctx->state = VOICE_STATE_IDLE;
    
    return VOICE_OK;
}

/* Set beam direction */
voice_error_t voice_set_beam_direction(voice_context_t* ctx, float angle_degrees) {
    if (!ctx || angle_degrees < 0.0f || angle_degrees > 360.0f) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    ctx->current_steering_angle = angle_degrees;
    return VOICE_OK;
}

/* Set adaptive beamforming */
voice_error_t voice_set_adaptive_beam(voice_context_t* ctx, bool enable) {
    if (!ctx) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    ctx->config.beamform.adaptive_mode = enable;
    return VOICE_OK;
}

/* Register wake word */
voice_error_t voice_register_wake_word(voice_context_t* ctx,
                                      const wake_word_model_t* model) {
    if (!ctx || !model || ctx->config.num_wake_words >= MAX_WAKE_WORDS) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    memcpy(&ctx->config.wake_words[ctx->config.num_wake_words],
           model, sizeof(wake_word_model_t));
    ctx->config.num_wake_words++;
    
    return VOICE_OK;
}

/* Set sensitivity */
voice_error_t voice_set_sensitivity(voice_context_t* ctx, float sensitivity) {
    if (!ctx || sensitivity < 0.0f || sensitivity > 1.0f) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    ctx->wake_sensitivity = sensitivity;
    return VOICE_OK;
}

/* Get statistics */
voice_error_t voice_get_stats(const voice_context_t* ctx, voice_stats_t* stats) {
    if (!ctx || !stats) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    memcpy(stats, &ctx->stats, sizeof(voice_stats_t));
    
    /* Calculate CPU usage (placeholder) */
    stats->cpu_usage_percent = 15.0f; // Would calculate actual usage
    
    return VOICE_OK;
}

/* Reset voice system */
voice_error_t voice_reset(voice_context_t* ctx) {
    if (!ctx) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    ctx->state = VOICE_STATE_IDLE;
    ctx->recording_size = 0;
    ctx->is_recording = false;
    ctx->vad_frame_count = 0;
    ctx->vad_active = false;
    
    /* Clear statistics */
    memset(&ctx->stats, 0, sizeof(voice_stats_t));
    ctx->stats.noise_floor_db = ctx->noise_floor;
    
    return VOICE_OK;
}

/* Set noise suppression */
voice_error_t voice_set_noise_suppression(voice_context_t* ctx, float level) {
    if (!ctx || level < 0.0f || level > 1.0f) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    /* Placeholder - would configure noise suppression algorithm */
    return VOICE_OK;
}

/* Calibrate noise floor */
voice_error_t voice_calibrate_noise(voice_context_t* ctx, uint32_t duration_ms) {
    if (!ctx || duration_ms < 100) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    /* Placeholder - would collect samples and calculate noise floor */
    /* For now, just reset to default */
    ctx->noise_floor = VAD_ENERGY_THRESHOLD;
    
    return VOICE_OK;
}

/* Register audio callback */
voice_error_t voice_register_audio_callback(voice_context_t* ctx,
                                           voice_audio_callback_t callback,
                                           void* user_data) {
    if (!ctx) {
        return VOICE_ERR_INVALID_PARAM;
    }
    
    ctx->audio_callback = callback;
    ctx->audio_callback_data = user_data;
    
    return VOICE_OK;
}