# 65C02 Emulator & Assembler
Portable JavaScript implementation of 65C02 Emulator and Assembler.

# Emulator usage
To include emulator use the `script` tag:
```html
<script src="w65.js"></script>
```
Before creating a CPU you need to write set & get functions:
```js
CPU.prototype.set = function(addr, data) { /* ... */ };
CPU.prototype.get = function(addr)       { return 0; };
```
A single 65C02 "Core" can be create as such:
```js
let cpu = new CPU();
```
To tick through one instruction, use `tick` instruction:
```js
cpu.tick();
```
This CPU also provides `halt` & `wait` flags (triggered by `jam` & `wai` instructions respectively) that are stored in `cpu.f`. To fetch them use the following code:
```js
let halt = cpu.f & 1;
let wait = cpu.f >> 1;
```

# Assembler
To include emulator use the `script` tag:
```html
<script src="a65.js"></script>
```
The assembler supports legal 6502 & 65C02 instructions (without `RMB`, `SMB`, `BBR` & `BBS` instructions). The following macros are also implemented:
| Macro | Argument | Description |
| ----- | -------- | ----------- |
| `.pos` | `(word)` | Sets assembler position |
| `.set` | `[byte / word] (string) (byte / word)` | Creates a custom label |
| `.byte` | `(bytes)` | Fills bytes |
| `.word` | `(words)` | Fills words |
| `.ascii` | `(strings)` | Fills text |

To assemble the code string, use the following function:
```js
let output = wAssemble(codeString);
```
You can also assemble in strict 6502 mode (not allowing using opcodes from 65C02):
```js
let output = wAssemble(codeString, true);
```
Assembler output consists of 2 elements: resulting ROM and label objects.
```
let ROM = output.rom;
let labels = output.defs;
```
ROM is represented by `Uint8Array(0x8000)`. Labels are represented with an object, where each label is stored with `WInt` object:
```js
let label = output['sampleLabel'];
let value = label.val;
let type = label.lim == 0xFF ? 'Byte' : 'Word'; // limit is 0xFF for Byte & 0xFFFF for Word
```
