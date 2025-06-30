/**
 * @file wake_word.h
 * @brief W.I.T. Wake Word Detection Module
 * 
 * Implements efficient wake word detection using neural networks
 * optimized for the Hailo-8L NPU.
 */

#ifndef WIT_WAKE_WORD_H
#define WIT_WAKE_WORD_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Configuration */
#define WAKE_WORD_WINDOW_MS         1500    // 1.5 second window
#define WAKE_WORD_STRIDE_MS         100     // 100ms stride
#define WAKE_WORD_FEATURE_DIM       40      // MFCC feature dimension
#define WAKE_WORD_MAX_MODELS        4       // Maximum simultaneous models
#define WAKE_WORD_POOLING_SIZE      8       // Inference result pooling

/* Error codes */
typedef enum {
    WAKE_OK = 0,
    WAKE_ERR_MEMORY = -1,
    WAKE_ERR_INVALID_MODEL = -2,
    WAKE_ERR_NPU_INIT = -3,
    WAKE_ERR_INFERENCE = -4,
    WAKE_ERR_INVALID_PARAM = -5
} wake_error_t;

/* Model formats */
typedef enum {
    WAKE_MODEL_ONNX = 0,
    WAKE_MODEL_TFLITE,
    WAKE_MODEL_HAILO_HEF,  // Hailo compiled format
    WAKE_MODEL_RAW_NN
} wake_model_format_t;

/* Detection result */
typedef struct {
    const char* wake_word;      // Detected wake word
    float confidence;           // Confidence score (0.0-1.0)
    uint32_t timestamp_ms;      // Detection timestamp
    uint32_t start_offset_ms;   // Start offset in audio buffer
    uint32_t end_offset_ms;     // End offset in audio buffer
} wake_detection_t;

/* Model information */
typedef struct {
    const char* name;           // Model name/wake word
    wake_model_format_t format; // Model format
    const uint8_t* data;        // Model data
    size_t size;                // Model size in bytes
    float threshold;            // Detection threshold
    bool requires_npu;          // Requires NPU acceleration
} wake_model_info_t;

/* Feature extraction config */
typedef struct {
    uint32_t sample_rate;       // Input sample rate
    uint32_t frame_size_ms;     // Frame size in milliseconds
    uint32_t frame_stride_ms;   // Frame stride in milliseconds
    uint32_t num_filters;       // Number of mel filters
    uint32_t num_coeffs;        // Number of MFCC coefficients
    float pre_emphasis;         // Pre-emphasis coefficient
    bool use_energy;            // Include energy feature
    bool use_deltas;            // Include delta features
} wake_feature_config_t;

/* Wake word engine handle */
typedef struct wake_engine wake_engine_t;

/* Callback for detection events */
typedef void (*wake_detection_callback_t)(const wake_detection_t* detection, 
                                         void* user_data);

/* Core Functions */

/**
 * @brief Initialize wake word detection engine
 * @param feature_config Feature extraction configuration
 * @return Engine handle or NULL on error
 */
wake_engine_t* wake_engine_init(const wake_feature_config_t* feature_config);

/**
 * @brief Deinitialize wake word engine
 * @param engine Engine handle
 */
void wake_engine_deinit(wake_engine_t* engine);

/**
 * @brief Load wake word model
 * @param engine Engine handle
 * @param model Model information
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_load_model(wake_engine_t* engine, 
                                   const wake_model_info_t* model);

/**
 * @brief Unload wake word model
 * @param engine Engine handle
 * @param model_name Name of model to unload
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_unload_model(wake_engine_t* engine, 
                                     const char* model_name);

/**
 * @brief Process audio frame for wake word detection
 * @param engine Engine handle
 * @param audio_data Audio samples (int16)
 * @param num_samples Number of samples
 * @param timestamp_ms Current timestamp
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_process(wake_engine_t* engine,
                                const int16_t* audio_data,
                                size_t num_samples,
                                uint32_t timestamp_ms);

/**
 * @brief Check if wake word was detected
 * @param engine Engine handle
 * @param detection Output detection result
 * @return true if wake word detected, false otherwise
 */
bool wake_engine_get_detection(wake_engine_t* engine, 
                              wake_detection_t* detection);

/**
 * @brief Register detection callback
 * @param engine Engine handle
 * @param callback Callback function
 * @param user_data User data for callback
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_register_callback(wake_engine_t* engine,
                                          wake_detection_callback_t callback,
                                          void* user_data);

/* Configuration Functions */

/**
 * @brief Set detection threshold for specific model
 * @param engine Engine handle
 * @param model_name Model name
 * @param threshold New threshold (0.0-1.0)
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_set_threshold(wake_engine_t* engine,
                                      const char* model_name,
                                      float threshold);

/**
 * @brief Enable/disable NPU acceleration
 * @param engine Engine handle
 * @param enable Enable NPU usage
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_set_npu_enabled(wake_engine_t* engine, bool enable);

/**
 * @brief Set detection pooling window
 * @param engine Engine handle
 * @param window_size Pooling window size in frames
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_set_pooling(wake_engine_t* engine, 
                                    uint32_t window_size);

/* Utility Functions */

/**
 * @brief Get engine statistics
 * @param engine Engine handle
 * @param avg_latency_ms Average inference latency
 * @param npu_usage NPU usage percentage
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_get_stats(const wake_engine_t* engine,
                                  float* avg_latency_ms,
                                  float* npu_usage);

/**
 * @brief Reset detection state
 * @param engine Engine handle
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_reset(wake_engine_t* engine);

/**
 * @brief Get loaded model names
 * @param engine Engine handle
 * @param names Array to store model names
 * @param max_names Maximum number of names
 * @param num_models Actual number of models
 * @return WAKE_OK or error code
 */
wake_error_t wake_engine_get_models(const wake_engine_t* engine,
                                   const char** names,
                                   size_t max_names,
                                   size_t* num_models);

/* Feature Extraction (can be used separately) */

/**
 * @brief Extract MFCC features from audio
 * @param audio Audio samples
 * @param num_samples Number of samples
 * @param sample_rate Sample rate
 * @param features Output feature array
 * @param feature_size Size of feature array
 * @return WAKE_OK or error code
 */
wake_error_t wake_extract_mfcc(const int16_t* audio,
                               size_t num_samples,
                               uint32_t sample_rate,
                               float* features,
                               size_t feature_size);

/**
 * @brief Create default feature configuration
 * @return Default feature configuration
 */
wake_feature_config_t wake_get_default_feature_config(void);

/* Model Management */

/**
 * @brief Validate model format and compatibility
 * @param model_data Model data
 * @param model_size Model size
 * @param format Model format
 * @return WAKE_OK if valid, error code otherwise
 */
wake_error_t wake_validate_model(const uint8_t* model_data,
                                size_t model_size,
                                wake_model_format_t format);

/**
 * @brief Get model metadata
 * @param model_data Model data
 * @param model_size Model size
 * @param format Model format
 * @param metadata Output metadata string
 * @param metadata_size Size of metadata buffer
 * @return WAKE_OK or error code
 */
wake_error_t wake_get_model_metadata(const uint8_t* model_data,
                                    size_t model_size,
                                    wake_model_format_t format,
                                    char* metadata,
                                    size_t metadata_size);

#ifdef __cplusplus
}
#endif

#endif /* WIT_WAKE_WORD_H */