#ifndef SERVO_H
#define SERVO_H

#include <stdint.h>

void Servo_Init(void);
void Servo_SetYawAngle(uint16_t angle);
void Servo_SetPitchAngle(uint16_t angle);

#endif
