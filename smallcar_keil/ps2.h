#ifndef PS2_H
#define PS2_H

#include <stdint.h>

#define PSB_LOSE               0
#define PSB_REDLIGHT_MODE      1
#define PSB_GREENLIGHT_MODE    2

#define PSB_SELECT      1
#define PSB_L3          2
#define PSB_R3          3
#define PSB_START       4
#define PSB_PAD_UP      5
#define PSB_PAD_RIGHT   6
#define PSB_PAD_DOWN    7
#define PSB_PAD_LEFT    8
#define PSB_L2          9
#define PSB_R2          10
#define PSB_L1          11
#define PSB_R1          12
#define PSB_GREEN       13
#define PSB_RED         14
#define PSB_BLUE        15
#define PSB_PINK        16

#define PSS_RX          5
#define PSS_RY          6
#define PSS_LX          7
#define PSS_LY          8

extern uint8_t  Data[9];
extern uint16_t MASK[16][2];
extern uint16_t Handkey;

void PS2_Init(void);
void PS2_ReadData(void);
uint8_t ps2_key_serch(void);
uint8_t ps2_get_key_state(uint8_t key_id);
uint8_t ps2_get_anolog_data(uint8_t button);

#endif
