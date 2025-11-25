#ifndef BATTERY_H
#define BATTERY_H

#include <stdint.h>

void Battery_ADC_Init(void);
uint32_t Battery_GetVoltage_mV(void);
uint8_t Battery_ConvertPercent(uint32_t mv);

#endif
