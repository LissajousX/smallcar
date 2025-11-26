#ifndef BUZZER_H
#define BUZZER_H

#include <stdint.h>

void Buzzer_Init(void);
void Buzzer_Task(void);
void Buzzer_StartShortTripleBeep(void);
void Buzzer_StartShortSingleBeep(void);
void Buzzer_StartPowerOnOkBeep(void);
void Buzzer_StartErrorBeep(void);

#endif
