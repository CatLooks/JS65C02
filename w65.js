////////////////////////////
///                      ///
///    65C02 Emulator    ///
///    by CatLooks       ///
///    License: MIT      ///
///                      ///
////////////////////////////

// 8-bit random generator
function random() {
	return Math.floor(Math.random() * 256);
};

// CPU flags
const FLAG_RESET = false;
const FLAG_SET = true;
const FLAG_N = 0x80;
const FLAG_V = 0x40;
const FLAG_U = 0x20;
const FLAG_B = 0x10;
const FLAG_D = 0x08;
const FLAG_I = 0x04;
const FLAG_Z = 0x02;
const FLAG_C = 0x01;

// CPU core
function CPU() {
	this.a = random();
	this.x = random();
	this.y = random();
	this.s = random();
	this.p = random() | FLAG_U | FLAG_B;
	this.i = random() | random() << 8;
	this.f = 1;
};

// dummy set & get functions
CPU.prototype.set = function(addr, data) {};
CPU.prototype.get = function(addr) { return random(); };

// vector trigger functions
CPU.prototype.rst = function() {
	this.i = this.getWord(0xFFFC);
	this.f = 0;
};
CPU.prototype.nmi = function() {
	if (!(this.f & 1)) {
		this.putWord(this.i);
		this.putByte(this.p | FLAG_U & ~FLAG_B);
		this.i = this.getWord(0xFFFE);
		this.f &= ~2;
	};
};
CPU.prototype.irq = function() {
	if (!(this.p & FLAG_I) && !(this.f & 1)) {
		this.putWord(this.i);
		this.putByte(this.p | FLAG_U & ~FLAG_B);
		this.i = this.getWord(0xFFFA);
		this.f &= ~2;
	};
};

// memory functions
CPU.prototype.nextByte = function() { let v = this.get(this.i++); this.i &= 0xFFFF; return v; };
CPU.prototype.nextWord = function() { let v = this.get(this.i++) | this.get(this.i++ & 0xFFFF) << 8; this.i &= 0xFFFF; return v; };
CPU.prototype.getByte  = function(addr) { return this.get(addr); };
CPU.prototype.getWord  = function(addr) { return this.get(addr) | this.get(addr + 1 & 0xFFFF) << 8; };
CPU.prototype.setByte  = function(addr, data) { this.set(addr, data); };
CPU.prototype.setWord  = function(addr, data) { this.set(addr, data & 0xFF); this.set(addr + 1 & 0xFFFF, data >> 8); };

// stack functions
CPU.prototype.putByte = function(data) { this.set((this.s-- & 0xFF) | 0x100, data); this.s &= 0xFF; };
CPU.prototype.putWord = function(data) { this.set((this.s-- & 0xFF) | 0x100, data >> 8); this.set((this.s-- & 0xFF) | 0x100, data & 0xFF); this.s &= 0xFF; };
CPU.prototype.popByte = function() { return this.get((++this.s & 0xFF) | 0x100); this.s &= 0xFF; };
CPU.prototype.popWord = function() { return this.get((++this.s & 0xFF) | 0x100) | this.get((++this.s & 0xFF) | 0x100) << 8; this.s &= 0xFF; };

// ALU functions
CPU.prototype.flag = function(flags, act) { if (act) this.p |= flags; else this.p &= ~flags; };
CPU.prototype.nz   = function(value) { this.flag(FLAG_N, value & 0x80); this.flag(FLAG_Z, value == 0); };
CPU.prototype.comp = function(a, b) {
	this.flag(FLAG_N, (a - b) & 0x80);
	this.flag(FLAG_C, a >= b);
	this.flag(FLAG_Z, a == b);
};
CPU.prototype.test = function(b) {
	this.flag(FLAG_Z, ~(this.a & b));
	this.p &= ~(FLAG_N | FLAG_V);
	this.p |= b & (FLAG_N | FLAG_V);
};
CPU.prototype.add = function(b) {
	let c = this.a + b + (this.p & FLAG_C ? 1 : 0);
	if (this.p & FLAG_D) {
		if ((this.a & 0xF) + (b & 0xF) + (this.p & FLAG_C ? 1 : 0) > 9)
			c += 0x06;
		if (c > 0x99)
			c += 0x60;
		this.flag(FLAG_C, c > 0x99);
	} else {
		this.flag(FLAG_C, c > 0xFF);
	};
	this.flag(FLAG_V, (this.a & 0x80) == 0 && (c & 0x80));
	this.a = c & 0xFF;
};
CPU.prototype.sub = function(b) {
	let c = this.a - b - (this.p & FLAG_C ? 0 : 1);
	if (this.p & FLAG_D) {
		if ((this.a & 0xF) - (this.p & FLAG_C ? 0 : 1) < (b & 0xF))
			c -= 0x06;
		if ((c & 0xFF) > 0x99)
			c -= 0x60;
	};
	this.flag(FLAG_C, (c & 0xFFFF) < 0x100);
	this.flag(FLAG_V, (this.a & 0x80) && (c & 0x80) == 0);
	this.a = c & 0xFF;
};

// addressing functions
adm_imp = function(cpu) {};
adm_imm = function(cpu) { let v = cpu.i++; cpu.i &= 0xFFFF; return v; };
adm_zpg = function(cpu) { return cpu.nextByte(); };
adm_zpx = function(cpu) { return cpu.nextByte() + cpu.x & 0xFF; };
adm_zpy = function(cpu) { return cpu.nextByte() + cpu.y & 0xFF; };
adm_abs = function(cpu) { return cpu.nextWord(); };
adm_abx = function(cpu) { return cpu.nextWord() + cpu.x & 0xFFFF; };
adm_aby = function(cpu) { return cpu.nextWord() + cpu.y & 0xFFFF; };
adm_izp = function(cpu) { return cpu.getWord(cpu.nextByte()); };
adm_izx = function(cpu) { return cpu.getWord(cpu.nextByte() + cpu.x & 0xFF); };
adm_izy = function(cpu) { return cpu.getWord(cpu.nextByte()) + cpu.y & 0xFFFF; };
adm_ind = function(cpu) { return cpu.getWord(cpu.nextWord()); };
adm_iax = function(cpu) { return cpu.getWord(cpu.nextWord() + cpu.x & 0xFFFF); };
adm_rel = function(cpu) { let v = cpu.nextByte(); if (v & 0x80) v -= 0x100; return cpu.i + v; };
adm_zpr = function(cpu) { cpu.nextByte(); cpu.nextByte(); cpu.nextByte(); };

// opcode functions
opc_nop = function(cpu, arg) {};
opc_brk = function(cpu, arg) {
	cpu.putWord(cpu.i + 1 & 0xFFFF);
	cpu.putByte(cpu.p | FLAG_U | FLAG_B);
	cpu.p |= FLAG_I;
	cpu.i = cpu.getWord(0xFFFA);
};
opc_jam = function(cpu, arg) { cpu.f |= 1; cpu.i--; };
opc_wai = function(cpu, arg) { cpu.f |= 2; };

opc_lda = function(cpu, arg) { cpu.nz(cpu.a = cpu.getByte(arg)); };
opc_ldx = function(cpu, arg) { cpu.nz(cpu.x = cpu.getByte(arg)); };
opc_ldy = function(cpu, arg) { cpu.nz(cpu.y = cpu.getByte(arg)); };

opc_sta = function(cpu, arg) { cpu.setByte(arg, cpu.a); };
opc_stx = function(cpu, arg) { cpu.setByte(arg, cpu.x); };
opc_sty = function(cpu, arg) { cpu.setByte(arg, cpu.y); };
opc_stz = function(cpu, arg) { cpu.setByte(arg, 0); };

opc_and = function(cpu, arg) { cpu.nz(cpu.a &= cpu.getByte(arg)); };
opc_ora = function(cpu, arg) { cpu.nz(cpu.a |= cpu.getByte(arg)); };
opc_eor = function(cpu, arg) { cpu.nz(cpu.a ^= cpu.getByte(arg)); };
opc_adc = function(cpu, arg) { cpu.add(cpu.getByte(arg)); cpu.nz(cpu.a); };
opc_sbc = function(cpu, arg) { cpu.sub(cpu.getByte(arg)); cpu.nz(cpu.a); };

opc_inc = function(cpu, arg) { let v = cpu.getByte(arg) + 1 & 0xFF; cpu.setByte(v); cpu.nz(v); };
opc_dec = function(cpu, arg) { let v = cpu.getByte(arg) - 1 & 0xFF; cpu.setByte(v); cpu.nz(v); };
opc_ina = function(cpu, arg) { cpu.a++; cpu.nz(cpu.a &= 0xFF); };
opc_dea = function(cpu, arg) { cpu.a--; cpu.nz(cpu.a &= 0xFF); };
opc_inx = function(cpu, arg) { cpu.x++; cpu.nz(cpu.x &= 0xFF); };
opc_dex = function(cpu, arg) { cpu.x--; cpu.nz(cpu.x &= 0xFF); };
opc_iny = function(cpu, arg) { cpu.y++; cpu.nz(cpu.y &= 0xFF); };
opc_dey = function(cpu, arg) { cpu.y--; cpu.nz(cpu.y &= 0xFF); };

opc_jmp = function(cpu, arg) { cpu.i = arg; };
opc_jsr = function(cpu, arg) { cpu.putWord(cpu.i); cpu.i = arg; };
opc_rts = function(cpu, arg) { cpu.i = cpu.popWord(); };
opc_rti = function(cpu, arg) { cpu.p = cpu.popByte() | FLAG_U; cpu.i = cpu.popWord(); };

opc_bpl = function(cpu, arg) { if (!(cpu.p & FLAG_N)) cpu.i = arg; };
opc_bmi = function(cpu, arg) { if (cpu.p & FLAG_N) cpu.i = arg; };
opc_bvc = function(cpu, arg) { if (!(cpu.p & FLAG_V)) cpu.i = arg; };
opc_bvs = function(cpu, arg) { if (cpu.p & FLAG_V) cpu.i = arg; };
opc_bcc = function(cpu, arg) { if (!(cpu.p & FLAG_C)) cpu.i = arg; };
opc_bcs = function(cpu, arg) { if (cpu.p & FLAG_C) cpu.i = arg; };
opc_bne = function(cpu, arg) { if (!(cpu.p & FLAG_Z)) cpu.i = arg; };
opc_beq = function(cpu, arg) { if (cpu.p & FLAG_Z) cpu.i = arg; };

opc_cmp = function(cpu, arg) { cpu.comp(cpu.a, cpu.getByte(arg)); };
opc_cpx = function(cpu, arg) { cpu.comp(cpu.x, cpu.getByte(arg)); };
opc_cpy = function(cpu, arg) { cpu.comp(cpu.y, cpu.getByte(arg)); };
opc_bit = function(cpu, arg) { cpu.test(cpu.getByte(arg)); };
opc_tsb = function(cpu, arg) { let v = cpu.getByte(arg) | cpu.a; cpu.setByte(arg, v); cpu.nz(v); };
opc_trb = function(cpu, arg) { let v = cpu.getByte(arg) & ~cpu.a; cpu.setByte(arg, v); cpu.nz(v); };

opc_php = function(cpu, arg) { cpu.putByte(cpu.p | FLAG_U | FLAG_B); };
opc_plp = function(cpu, arg) { cpu.p = cpu.popByte(); };
opc_pha = function(cpu, arg) { cpu.putByte(cpu.a); };
opc_pla = function(cpu, arg) { cpu.a = cpu.popByte(); };
opc_phx = function(cpu, arg) { cpu.putByte(cpu.x); };
opc_plx = function(cpu, arg) { cpu.x = cpu.popByte(); };
opc_phy = function(cpu, arg) { cpu.putByte(cpu.y); };
opc_ply = function(cpu, arg) { cpu.y = cpu.popByte(); };

opc_clc = function(cpu, arg) { cpu.p &= ~FLAG_C; };
opc_sec = function(cpu, arg) { cpu.p |= FLAG_C; };
opc_cli = function(cpu, arg) { cpu.p &= ~FLAG_I; };
opc_sei = function(cpu, arg) { cpu.p |= FLAG_I; };
opc_cld = function(cpu, arg) { cpu.p &= ~FLAG_D; };
opc_sed = function(cpu, arg) { cpu.p |= FLAG_D; };
opc_clv = function(cpu, arg) { cpu.p &= ~FLAG_V; };

opc_tax = function(cpu, arg) { cpu.nz(cpu.x = cpu.a); };
opc_txa = function(cpu, arg) { cpu.nz(cpu.a = cpu.x); };
opc_tay = function(cpu, arg) { cpu.nz(cpu.y = cpu.a); };
opc_tya = function(cpu, arg) { cpu.nz(cpu.a = cpu.y); };
opc_tsx = function(cpu, arg) { cpu.nz(cpu.x = cpu.s); };
opc_txs = function(cpu, arg) { cpu.s = cpu.x; };

opc_sla = function(cpu, arg) { cpu.flag(FLAG_C, cpu.a & 0x80); cpu.nz(cpu.a = cpu.a << 1 & 0xFF); };
opc_sra = function(cpu, arg) { cpu.flag(FLAG_C, cpu.a & 0x01); cpu.nz(cpu.a >>= 1); };
opc_rla = function(cpu, arg) {
	let c = cpu.p & FLAG_C ? 0x01 : 0;
	cpu.flag(FLAG_C, cpu.a & 0x80);
	cpu.nz(cpu.a = (cpu.a << 1 | c) & 0xFF);
};
opc_rra = function(cpu, arg) {
	let c = cpu.p & FLAG_C ? 0x80 : 0;
	cpu.flag(FLAG_C, cpu.a & 0x01);
	cpu.nz(cpu.a = cpu.a >> 1 | c);
};
opc_asl = function(cpu, arg) {
	let v = cpu.getByte(arg);
	cpu.flag(FLAG_C, v & 0x80);
	cpu.nz(v = v << 1 & 0xFF);
	cpu.setByte(arg, v);
};
opc_lsr = function(cpu, arg) {
	let v = cpu.getByte(arg);
	cpu.flag(FLAG_C, v & 0x01);
	cpu.nz(v >>= 1);
	cpu.setByte(arg, v);
};
opc_rol = function(cpu, arg) {
	let v = cpu.getByte(arg);
	let c = cpu.p & FLAG_C ? 0x01 : 0;
	cpu.flag(FLAG_C, v & 0x80);
	cpu.nz(v = (v << 1 | c) & 0xFF);
	cpu.setByte(arg, v);
};
opc_ror = function(cpu, arg) {
	let v = cpu.getByte(arg);
	let c = cpu.p & FLAG_C ? 0x80 : 0;
	cpu.flag(FLAG_C, v & 0x01);
	cpu.nz(v = v >> 1 | c);
	cpu.setByte(arg, v);
};

// lookup tables
CPU_lookup_modes = [
	adm_imp, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_abs, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imp, adm_zpg, adm_zpx, adm_zpx, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_abs, adm_abx, adm_abx, adm_zpr,
	adm_abs, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_abs, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imp, adm_zpx, adm_zpx, adm_zpx, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_abx, adm_abx, adm_abx, adm_zpr,
	adm_imp, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_abs, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imp, adm_zpx, adm_zpx, adm_zpx, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_abs, adm_abx, adm_abx, adm_zpr,
	adm_imp, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_ind, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imp, adm_zpx, adm_zpx, adm_zpx, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_iax, adm_abx, adm_abx, adm_zpr,
	adm_rel, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_abs, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imp, adm_zpx, adm_zpx, adm_zpx, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_abs, adm_abx, adm_abx, adm_zpr,
	adm_imm, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_abs, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imp, adm_zpx, adm_zpx, adm_zpy, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_abx, adm_abx, adm_aby, adm_zpr,
	adm_imm, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_abs, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imp, adm_zpx, adm_zpx, adm_zpx, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_abs, adm_abx, adm_abx, adm_zpr,
	adm_imm, adm_izx, adm_imm, adm_imp, adm_zpg, adm_zpg, adm_zpg, adm_zpg, adm_imp, adm_imm, adm_imp, adm_imp, adm_abs, adm_abs, adm_abs, adm_zpr,
	adm_rel, adm_izy, adm_izp, adm_imm, adm_zpx, adm_zpx, adm_zpx, adm_zpg, adm_imp, adm_aby, adm_imp, adm_imp, adm_abs, adm_abx, adm_abx, adm_zpr
];
CPU_lookup_opcs = [
	opc_brk, opc_ora, opc_nop, opc_nop, opc_tsb, opc_ora, opc_asl, opc_nop, opc_php, opc_ora, opc_sla, opc_nop, opc_tsb, opc_ora, opc_asl, opc_nop,
	opc_bpl, opc_ora, opc_ora, opc_nop, opc_trb, opc_ora, opc_asl, opc_nop, opc_clc, opc_ora, opc_ina, opc_nop, opc_trb, opc_ora, opc_asl, opc_nop,
	opc_jsr, opc_and, opc_nop, opc_nop, opc_bit, opc_and, opc_rol, opc_nop, opc_plp, opc_and, opc_rla, opc_nop, opc_bit, opc_and, opc_rol, opc_nop,
	opc_bmi, opc_and, opc_and, opc_nop, opc_bit, opc_and, opc_rol, opc_nop, opc_sec, opc_and, opc_dea, opc_nop, opc_bit, opc_and, opc_rol, opc_nop,
	opc_rti, opc_eor, opc_nop, opc_nop, opc_nop, opc_eor, opc_lsr, opc_nop, opc_pha, opc_eor, opc_sra, opc_nop, opc_jmp, opc_eor, opc_lsr, opc_nop,
	opc_bvc, opc_eor, opc_eor, opc_nop, opc_nop, opc_eor, opc_lsr, opc_nop, opc_cli, opc_eor, opc_phy, opc_nop, opc_nop, opc_eor, opc_lsr, opc_nop,
	opc_rts, opc_adc, opc_nop, opc_nop, opc_stz, opc_adc, opc_ror, opc_nop, opc_pla, opc_adc, opc_rra, opc_nop, opc_jmp, opc_adc, opc_ror, opc_nop,
	opc_bvs, opc_adc, opc_adc, opc_nop, opc_stz, opc_adc, opc_ror, opc_nop, opc_sei, opc_adc, opc_ply, opc_nop, opc_jmp, opc_adc, opc_ror, opc_nop,
	opc_jmp, opc_sta, opc_nop, opc_nop, opc_sty, opc_sta, opc_stx, opc_nop, opc_dey, opc_bit, opc_txa, opc_nop, opc_sty, opc_sta, opc_stx, opc_nop,
	opc_bcc, opc_sta, opc_sta, opc_nop, opc_sty, opc_sta, opc_stx, opc_nop, opc_tya, opc_sta, opc_txs, opc_nop, opc_stz, opc_sta, opc_stz, opc_nop,
	opc_ldy, opc_lda, opc_ldx, opc_nop, opc_ldy, opc_lda, opc_ldx, opc_nop, opc_tay, opc_lda, opc_tax, opc_nop, opc_ldy, opc_lda, opc_ldx, opc_nop,
	opc_bcs, opc_lda, opc_lda, opc_nop, opc_ldy, opc_lda, opc_ldx, opc_nop, opc_clv, opc_lda, opc_tsx, opc_nop, opc_ldy, opc_lda, opc_ldx, opc_nop,
	opc_cpy, opc_cmp, opc_nop, opc_nop, opc_cpy, opc_cmp, opc_dec, opc_nop, opc_iny, opc_cmp, opc_dex, opc_wai, opc_cpy, opc_cmp, opc_dec, opc_nop,
	opc_bne, opc_cmp, opc_cmp, opc_nop, opc_nop, opc_cmp, opc_dec, opc_nop, opc_cld, opc_cmp, opc_phx, opc_jam, opc_nop, opc_cmp, opc_dec, opc_nop,
	opc_cpx, opc_sbc, opc_nop, opc_nop, opc_cpx, opc_sbc, opc_inc, opc_nop, opc_inx, opc_sbc, opc_nop, opc_nop, opc_cpx, opc_sbc, opc_inc, opc_nop,
	opc_beq, opc_sbc, opc_sbc, opc_nop, opc_nop, opc_sbc, opc_inc, opc_nop, opc_sed, opc_sbc, opc_plx, opc_nop, opc_nop, opc_sbc, opc_inc, opc_nop
];

// ticker function
CPU.prototype.tick = function() {
	if (this.f) return;
	opc = this.nextByte();
	//console.log(opc);
	CPU_lookup_opcs[opc](this, CPU_lookup_modes[opc](this));
};