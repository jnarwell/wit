/**
 * @file audio_driver.h
 * @brief W.I.T. Multi-channel Audio Driver
 * 
 * Handles multi-channel audio capture from microphone array
 * with support for I2S, PDM, and USB audio interfaces.
 */

#ifndef WIT_AUDIO_DRIVER_H
#define WIT_AUDIO_DRIVER_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Audio Interface Types */
typedef enum {
    AUDIO_INTERFACE_I2S = 0,    // I2S digital audio
    AUDIO_INTERFACE_PDM,        // PDM microphones
    AUDIO_INTERFACE_USB,        // USB audio class
    AUDIO_INTERFACE_ANALOG      // Analog ADC
} audio_interface_t;

/* Audio Formats */
typedef enum {
    AUDIO_FORMAT_S16_LE = 0,    // 16-bit signed little-endian
    AUDIO_FORMAT_S24_LE,        // 24-bit signed little-endian
    AUDIO_FORMAT_S32_LE,        // 32-bit signed little-endian
    AUDIO_FORMAT_F32_LE         // 32-bit float little-endian
} audio_format_t;

/* Error Codes */
typedef enum {
    AUDIO_OK = 0,
    AUDIO_ERR_INIT = -1,
    AUDIO_ERR_CONFIG = -2,
    AUDIO_ERR_HARDWARE = -3,
    AUDIO_ERR_BUFFER = -4,
    AUDIO_ERR_TIMEOUT = -5,
    AUDIO_ERR_INVALID_PARAM = -6,
    AUDIO_ERR_NOT_READY = -7
} audio_error_t;

/* Channel Configuration */
#define AUDIO_MAX_CHANNELS      8
#define AUDIO_DEFAULT_CHANNELS  4

/* Buffer Configuration */
#define AUDIO_BUFFER_COUNT      4   // Number of DMA buffers
#define AUDIO_BUFFER_SIZE_MS    20  // Buffer size in milliseconds

/* Microphone Array Geometry */
typedef struct {
    float x;    // X coordinate in meters
    float y;    // Y coordinate in meters
    float z;    // Z coordinate in meters
} mic_position_t;

/* Audio Configuration */
typedef struct {
    audio_interface_t interface;
    uint32_t sample_rate;
    uint8_t channels;
    audio_format_t format;
    uint16_t buffer_size_samples;
    
    /* Interface-specific config */
    union {
        struct {
            uint8_t bck_pin;        // Bit clock
            uint8_t ws_pin;         // Word select
            uint8_t data_in_pin;    // Data input
            uint8_t mclk_pin;       // Master clock (optional)
            bool use_apll;          // Use audio PLL
        } i2s;
        
        struct {
            uint8_t clk_pin;        // PDM clock
            uint8_t data_pins[AUDIO_MAX_CHANNELS]; // PDM data pins
            uint32_t clk_freq;      // PDM clock frequency
        } pdm;
        
        struct {
            uint16_t vendor_id;
            uint16_t product_id;
            uint8_t interface_num;
            uint8_t alt_setting;
        } usb;
        
        struct {
            uint8_t adc_pins[AUDIO_MAX_CHANNELS];
            uint16_t adc_resolution;    // 12, 16, or 24 bits
            float input_range_v;        // Input voltage range
        } analog;
    } config;
    
    /* Microphone positions for beamforming */
    mic_position_t mic_positions[AUDIO_MAX_CHANNELS];
    
    /* Preprocessing options */
    bool enable_dc_removal;
    bool enable_agc;            // Automatic gain control
    bool enable_noise_gate;
    float gain_db;              // Manual gain in dB
} audio_config_t;

/* Audio Statistics */
typedef struct {
    uint32_t samples_captured;
    uint32_t buffer_overruns;
    uint32_t dma_errors;
    float avg_level_db[AUDIO_MAX_CHANNELS];
    float peak_level_db[AUDIO_MAX_CHANNELS];
    uint32_t clipping_count[AUDIO_MAX_CHANNELS];
    float dc_offset[AUDIO_MAX_CHANNELS];
} audio_stats_t;

/* Audio Buffer */
typedef struct {
    void* data;                 // Buffer data
    size_t size;                // Buffer size in bytes
    size_t samples_per_channel; // Samples per channel
    uint8_t channels;           // Number of channels
    audio_format_t format;      // Sample format
    uint32_t timestamp_us;      // Capture timestamp
    bool is_ready;              // Buffer ready flag
} audio_buffer_t;

/* Audio Driver Handle */
typedef struct audio_driver audio_driver_t;

/* Audio Callback */
typedef void (*audio_callback_t)(const audio_buffer_t* buffer, void* user_data);

/* Core Functions */

/**
 * @brief Initialize audio driver
 * @param config Audio configuration
 * @return Driver handle or NULL on error
 */
audio_driver_t* audio_driver_init(const audio_config_t* config);

/**
 * @brief Deinitialize audio driver
 * @param driver Driver handle
 */
void audio_driver_deinit(audio_driver_t* driver);

/**
 * @brief Start audio capture
 * @param driver Driver handle
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_start(audio_driver_t* driver);

/**
 * @brief Stop audio capture
 * @param driver Driver handle
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_stop(audio_driver_t* driver);

/**
 * @brief Read audio data (blocking)
 * @param driver Driver handle
 * @param buffer Output buffer
 * @param timeout_ms Timeout in milliseconds (0 = no timeout)
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_read(audio_driver_t* driver, 
                               audio_buffer_t* buffer,
                               uint32_t timeout_ms);

/**
 * @brief Register audio callback (non-blocking mode)
 * @param driver Driver handle
 * @param callback Callback function
 * @param user_data User data for callback
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_register_callback(audio_driver_t* driver,
                                            audio_callback_t callback,
                                            void* user_data);

/* Configuration Functions */

/**
 * @brief Set audio gain
 * @param driver Driver handle
 * @param gain_db Gain in decibels
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_set_gain(audio_driver_t* driver, float gain_db);

/**
 * @brief Set channel gain
 * @param driver Driver handle
 * @param channel Channel index
 * @param gain_db Gain in decibels
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_set_channel_gain(audio_driver_t* driver,
                                           uint8_t channel,
                                           float gain_db);

/**
 * @brief Enable/disable automatic gain control
 * @param driver Driver handle
 * @param enable Enable AGC
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_set_agc(audio_driver_t* driver, bool enable);

/**
 * @brief Configure noise gate
 * @param driver Driver handle
 * @param threshold_db Threshold in dB
 * @param attack_ms Attack time in milliseconds
 * @param release_ms Release time in milliseconds
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_set_noise_gate(audio_driver_t* driver,
                                         float threshold_db,
                                         uint32_t attack_ms,
                                         uint32_t release_ms);

/* Utility Functions */

/**
 * @brief Get driver statistics
 * @param driver Driver handle
 * @param stats Output statistics
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_get_stats(const audio_driver_t* driver,
                                    audio_stats_t* stats);

/**
 * @brief Reset statistics
 * @param driver Driver handle
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_reset_stats(audio_driver_t* driver);

/**
 * @brief Get buffer from pool
 * @param driver Driver handle
 * @return Buffer or NULL if none available
 */
audio_buffer_t* audio_driver_get_buffer(audio_driver_t* driver);

/**
 * @brief Return buffer to pool
 * @param driver Driver handle
 * @param buffer Buffer to return
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_return_buffer(audio_driver_t* driver,
                                        audio_buffer_t* buffer);

/**
 * @brief Perform DC offset calibration
 * @param driver Driver handle
 * @param duration_ms Calibration duration
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_calibrate_dc(audio_driver_t* driver,
                                       uint32_t duration_ms);

/**
 * @brief Test microphone channels
 * @param driver Driver handle
 * @param results Array to store test results (0=fail, 1=pass)
 * @return AUDIO_OK or error code
 */
audio_error_t audio_driver_test_channels(audio_driver_t* driver,
                                        uint8_t* results);

/* Format Conversion Utilities */

/**
 * @brief Convert audio format
 * @param src Source buffer
 * @param src_format Source format
 * @param dst Destination buffer
 * @param dst_format Destination format
 * @param samples Number of samples to convert
 * @return AUDIO_OK or error code
 */
audio_error_t audio_convert_format(const void* src,
                                  audio_format_t src_format,
                                  void* dst,
                                  audio_format_t dst_format,
                                  size_t samples);

/**
 * @brief Interleave audio channels
 * @param src Array of channel buffers
 * @param dst Interleaved output buffer
 * @param channels Number of channels
 * @param samples_per_channel Samples per channel
 * @param format Sample format
 * @return AUDIO_OK or error code
 */
audio_error_t audio_interleave(const void** src,
                               void* dst,
                               uint8_t channels,
                               size_t samples_per_channel,
                               audio_format_t format);

/**
 * @brief Deinterleave audio channels
 * @param src Interleaved input buffer
 * @param dst Array of channel buffers
 * @param channels Number of channels
 * @param samples_per_channel Samples per channel
 * @param format Sample format
 * @return AUDIO_OK or error code
 */
audio_error_t audio_deinterleave(const void* src,
                                void** dst,
                                uint8_t channels,
                                size_t samples_per_channel,
                                audio_format_t format);

/* Platform-specific initialization */

/**
 * @brief Get default I2S configuration
 * @return Default I2S configuration
 */
audio_config_t audio_get_default_i2s_config(void);

/**
 * @brief Get default PDM configuration
 * @return Default PDM configuration
 */
audio_config_t audio_get_default_pdm_config(void);

/**
 * @brief Get default USB configuration
 * @return Default USB configuration
 */
audio_config_t audio_get_default_usb_config(void);

#ifdef __cplusplus
}
#endif

#endif /* WIT_AUDIO_DRIVER_H */