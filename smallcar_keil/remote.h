#ifndef REMOTE_H
#define REMOTE_H

#include <stdint.h>

typedef struct
{
    int16_t throttle;
    int16_t steer;
    int16_t yaw;
    int16_t pitch;
    uint8_t valid;
    uint32_t last_tick;
} RemoteCmd_t;

void Remote_Reset(volatile RemoteCmd_t *cmd);
void Remote_ParseLine(char *line, volatile RemoteCmd_t *cmd, uint32_t loop_counter);

#endif
