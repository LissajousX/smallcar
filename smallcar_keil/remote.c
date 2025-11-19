#include "remote.h"
#include <stdlib.h>

void Remote_Reset(volatile RemoteCmd_t *cmd)
{
    if (cmd == 0)
    {
        return;
    }

    cmd->throttle = 0;
    cmd->steer = 0;
    cmd->yaw = -1;
    cmd->pitch = -1;
    cmd->valid = 0U;
    cmd->last_tick = 0U;
}

void Remote_ParseLine(char *line, volatile RemoteCmd_t *cmd, uint32_t loop_counter)
{
    char *p;
    char *endptr;
    int values[4];
    int i;
    int thr;
    int steer;
    int yaw;
    int pitch;

    if (line == 0 || cmd == 0)
    {
        return;
    }

    if (line[0] != 'C' && line[0] != 'c')
    {
        return;
    }

    p = line + 1;
    if (*p == ',')
    {
        p++;
    }

    for (i = 0; i < 4; i++)
    {
        values[i] = (int)strtol(p, &endptr, 10);
        if (endptr == p)
        {
            return;
        }
        if (*endptr == ',')
        {
            p = endptr + 1;
        }
        else
        {
            p = endptr;
        }
    }

    thr = values[0];
    steer = values[1];
    yaw = values[2];
    pitch = values[3];

    if (thr > 100)
    {
        thr = 100;
    }
    else if (thr < -100)
    {
        thr = -100;
    }

    if (steer > 100)
    {
        steer = 100;
    }
    else if (steer < -100)
    {
        steer = -100;
    }

    if (yaw < -1)
    {
        yaw = -1;
    }
    else if (yaw > 180)
    {
        yaw = 180;
    }

    if (pitch < -1)
    {
        pitch = -1;
    }
    else if (pitch > 180)
    {
        pitch = 180;
    }

    cmd->throttle = (int16_t)thr;
    cmd->steer = (int16_t)steer;
    cmd->yaw = (int16_t)yaw;
    cmd->pitch = (int16_t)pitch;
    cmd->valid = 1U;
    cmd->last_tick = loop_counter;
}
