let lookup_opc_names = [];
let lookup_opc_modes = [];

// generate opcode lookup tables
for (let i = 0; i < 256; i++) {
	lookup_opc_names.push(CPU_lookup_opcs[i].name.slice(4).toUpperCase());
	switch (CPU_lookup_modes[i].name.slice(4)) {
		case 'imp': lookup_opc_modes.push(''); break;
		case 'acc': lookup_opc_modes.push(' A'); break;
		case 'imm': lookup_opc_modes.push(' #imm'); break;
		case 'zpg': lookup_opc_modes.push(' zpg'); break;
		case 'zpx': lookup_opc_modes.push(' zpg, x'); break;
		case 'zpy': lookup_opc_modes.push(' zpg, y'); break;
		case 'abs': lookup_opc_modes.push(' abs'); break;
		case 'abx': lookup_opc_modes.push(' abs, x'); break;
		case 'aby': lookup_opc_modes.push(' abs, y'); break;
		case 'izp': lookup_opc_modes.push(' (izp)'); break;
		case 'izx': lookup_opc_modes.push(' (izp, x)'); break;
		case 'izy': lookup_opc_modes.push(' (izp), y'); break;
		case 'ind': lookup_opc_modes.push(' (ind)'); break;
		case 'iax': lookup_opc_modes.push(' (ind, x)'); break;
		case 'rel': lookup_opc_modes.push(' rel'); break;
		case 'zpr': lookup_opc_modes.push(' abs, zpg'); break;
		default: lookup_opc_modes.push(' ?');
	};
};

// convert to base function
function wCast(num, base, pad) {
	let res = num.toString(base);
	if (res.length > pad)
		return res.slice(res.length - pad).toUpperCase();
	while (res.length < pad)
		res = '0' + res;
	return res.toUpperCase();
};

// fetch opcode mode data
function wFetchOpcodeMode(cpu, addr, opc) {
	let str = lookup_opc_names[opc];
	switch (str) {
		case 'INA': str = 'INC a'; break;
		case 'DEA': str = 'DEC a'; break;
		case 'SLA': str = 'ASL a'; break;
		case 'SRA': str = 'LSR a'; break;
		case 'RLA': str = 'ROL a'; break;
		case 'RRA': str = 'ROR a'; break;
		default: break;
	};
	switch (CPU_lookup_modes[opc].name.slice(4)) {
		case 'imp': return str + '';
		case 'acc': return str + ' a';
		case 'imm': return str + ` #$${wCast(cpu.getByte(addr), 16, 2)}`;
		case 'zpg': return str + ` $${wCast(cpu.getByte(addr), 16, 2)}`;
		case 'zpx': return str + ` $${wCast(cpu.getByte(addr), 16, 2)}, x`;
		case 'zpy': return str + ` $${wCast(cpu.getByte(addr), 16, 2)}, y`;
		case 'abs': return str + ` $${wCast(cpu.getWord(addr), 16, 4)}`;
		case 'abx': return str + ` $${wCast(cpu.getWord(addr), 16, 4)}, x`;
		case 'aby': return str + ` $${wCast(cpu.getWord(addr), 16, 4)}, y`;
		case 'izp': return str + ` ($${wCast(cpu.getByte(addr), 16, 2)})`;
		case 'izx': return str + ` ($${wCast(cpu.getByte(addr), 16, 2)}, x)`;
		case 'izy': return str + ` ($${wCast(cpu.getByte(addr), 16, 2)}), y`;
		case 'ind': return str + ` ($${wCast(cpu.getWord(addr), 16, 4)})`;
		case 'iax': return str + ` ($${wCast(cpu.getWord(addr), 16, 4)}, x)`;
		case 'rel': return str + ` +$${wCast(cpu.getByte(addr), 16, 2)}`;
		case 'zpr': return str + ` $${wCast(cpu.getWord(addr), 16, 4)}, $${wCast(cpu.getByte(addr + 2), 16, 2)}`;
		default: return str + ' ?';
	};
};

// memory viewer object
function WMemView(cpu, size) {
	let div = document.createElement('div');
	let mem = document.createElement('table');
	mem.onmousewheel = (evt) => {
		this.shift += Math.floor(evt.deltaY / 100) * 16;
		this.shift &= 0xFFFF;
		this.display();
		evt.preventDefault();
		evt.stopPropagation();
	};
	mem.setAttribute('class', 'fmt-table fmt-code');
	this.cpu = cpu;
	this.cells = [];
	this.addrs = [];
	this.texts = [];
	this.shift = 0x8000;
	this.select = 0;
	this.size = size;

	// create current address display
	let row = document.createElement('tr');
	let addr = document.createElement('th');
	addr.setAttribute('class', 'fmt-pos');
	addr.innerHTML = `$${wCast(0, 16, 4)}`;
	row.appendChild(addr);
	this.pos = addr;

	// create offset labels
	for (let x = 0; x < 16; x++) {
		let col = document.createElement('th');
		col.setAttribute('class', `fmt-off`);
		col.innerHTML = `${wCast(x, 16, 2)}`;
		row.appendChild(col);
	};
	let col = document.createElement('th');
	col.setAttribute('class', `fmt-off`);
	col.innerHTML = `Symbols`;
	row.appendChild(col);
	mem.appendChild(row);

	// create cells
	for (let y = 0; y < this.size; y++) {
		let row = document.createElement('tr');

		// create address
		let addr = document.createElement('th');
		addr.setAttribute('class', 'fmt-addr unselectable');
		addr.innerHTML = `$${wCast(0, 16, 4)}`;
		row.appendChild(addr);
		this.addrs.push(addr);

		// create cells
		for (let x = 0; x < 16; x++) {
			let col = document.createElement('td');

			// create cell
			col.setAttribute('class', `fmt-cell fmt-col${x & 1}`);
			col.innerHTML = `..`;
			col.onclick = () => {
				this.select = (this.shift + x + y * 16) & 0xFFFF;
				this.pos.innerHTML = `$${wCast(this.select, 16, 4)}`;
				this.set_addr.innerHTML = `<span style="color: #9E7;">${this.pos.innerHTML}</span> = $`;
				this.display();
			};
			row.appendChild(col);
			this.cells.push(col);
		};
		mem.appendChild(row);

		// create text
		let col = document.createElement('td');
		col.setAttribute('class', `fmt-cell fmt-col0`);
		for (let x = 0; x < 16; x++) {
			let ncol = document.createElement('span');
			ncol.style = 'display: inline-block;';
			ncol.onclick = () => {
				this.select = (this.shift + x + y * 16) & 0xFFFF;
				this.pos.innerHTML = `$${wCast(this.select, 16, 4)}`;
				this.set_addr.innerHTML = `<span style="color: #9E7;">${this.pos.innerHTML}</span> = $`;
				this.display();
			};
			ncol.setAttribute('class', 'unselectable');
			ncol.innerHTML = '.';
			col.appendChild(ncol);
			this.texts.push(ncol);
		};
		row.appendChild(col);
	};
	div.appendChild(mem);
	this.div = div;
	this.mem = mem;

	// create function tables
	//let funst = document.createElement('table');
	//funst.setAttribute('class', 'fmt-table fmt-user');
	let funs = document.createElement('tr');
	funs.setAttribute('colspan', '18');
	funs.setAttribute('class', 'fmt-table fmt-user');

	// position seeker
	let f_goto = document.createElement('td');
	f_goto.setAttribute('colspan', '6');
	f_goto.setAttribute('class', 'fmt-ctrl');
	let f_goto_label = document.createElement('b');
	f_goto_label.style = 'padding-right: 4px; color: #B8F;';
	f_goto_label.innerHTML = '$';
	f_goto.appendChild(f_goto_label);
	let f_goto_input = document.createElement('input');
	f_goto_input.setAttribute('class', 'fmt-input');
	f_goto_input.setAttribute('maxlength', '4');
	f_goto_input.oninput = (evt) => {
		let str = evt.target.value;
		let out = '';
		for (let i = 0; i < str.length; i++) {
			if ('0123456789ABCDEFabcdef'.includes(str[i]))
				out += str[i].toUpperCase();
		};
		evt.target.value = out;
	};
	f_goto.appendChild(f_goto_input);
	this.goto_input = f_goto_input;
	let f_goto_btn = document.createElement('button');
	f_goto_btn.setAttribute('class', 'fmt-btn');
	f_goto_btn.textContent = 'Seek';
	f_goto_btn.onclick = () => {
		this.shift = parseInt(this.goto_input.value, 16) & 0xFFF0;
		this.display();
	};
	f_goto_input.onchange = f_goto_btn.onclick;
	f_goto.appendChild(f_goto_btn);

	// value changer
	let f_set = document.createElement('td');
	f_set.setAttribute('colspan', '10');
	f_set.setAttribute('class', 'fmt-ctrl');
	let f_set_label = document.createElement('b');
	f_set_label.style = 'padding-right: 4px; color: #B8F;';
	f_set_label.innerHTML = '<span style="color: #9E7;">$0000</span> = $';
	f_set.appendChild(f_set_label);
	this.set_addr = f_set_label;
	let f_set_data = document.createElement('input');
	f_set_data.setAttribute('class', 'fmt-input');
	f_set_data.setAttribute('maxlength', '2');
	f_set_data.oninput = (evt) => {
		let str = evt.target.value;
		let out = '';
		for (let i = 0; i < str.length; i++) {
			if ('0123456789ABCDEFabcdef'.includes(str[i]))
				out += str[i].toUpperCase();
		};
		evt.target.value = out;
	};
	f_set.appendChild(f_set_data);
	this.set_data = f_set_data;
	let f_set_btn = document.createElement('button');
	f_set_btn.setAttribute('class', 'fmt-btn');
	f_set_btn.textContent = 'Set';
	f_set_btn.onclick = () => {
		this.cpu.set(this.select, parseInt(this.set_data.value, 16));
		this.display();
	};
	f_set.appendChild(f_set_btn);

	// selecting option
	let f_sel = document.createElement('td');
	f_sel.setAttribute('colspan', '2');
	f_sel.setAttribute('class', 'fmt-ctrl');
	let f_sel_list = document.createElement('select');
	f_sel_list.setAttribute('class', 'fmt-list');
	let f_sel_opt0 = document.createElement('option');
	f_sel_opt0.innerHTML = 'Select Bytes';
	f_sel_list.appendChild(f_sel_opt0);
	let f_sel_opt1 = document.createElement('option');
	f_sel_opt1.innerHTML = 'Select Text';
	f_sel_list.appendChild(f_sel_opt1);
	f_sel.onchange = (evt) => {
		if (evt.target.value == 'Select Bytes') {
			this.cells.forEach((el) => {
				el.classList.remove('unselectable');
			});
			this.texts.forEach((el) => {
				el.classList.add('unselectable');
			});
		} else {
			this.texts.forEach((el) => {
				el.classList.remove('unselectable');
			});
			this.cells.forEach((el) => {
				el.classList.add('unselectable');
			});
		};
	};
	f_sel.appendChild(f_sel_list);

	// add functions
	funs.appendChild(f_goto);
	funs.appendChild(f_set);
	funs.appendChild(f_sel);
	mem.appendChild(funs);
};

// display ROM
WMemView.prototype.display = function() {
	for (let r = 0; r < this.size; r++) {
		this.addrs[r].innerHTML = `$${wCast(this.shift + r * 16, 16, 4)}`;
		for (let c = 0; c < 16; c++) {
			let i = r * 16 + c;
			let v = this.cpu.get((this.shift + i) & 0xFFFF);
			let s = ((v >= 0x20 && v < 0x80) || v >= 0xA0) ? String.fromCharCode(v) : '.'
			if (s == ' ') s = '&nbsp; ';
			this.cells[i].innerHTML = `${wCast(v, 16, 2)}`;
			this.texts[i].innerHTML = s;
			let ID = '';
			switch ((this.shift + i) & 0xFFFF) {
				case this.select:
				ID = 'fmt-sl-ptr';
				break;
				case this.cpu.i:
				ID = 'fmt-ip-ptr';
				break;
				case this.cpu.s | 0x100:
				ID = 'fmt-sp-ptr';
				break;
			};
			this.cells[i].setAttribute('id', ID);
			this.texts[i].setAttribute('id', ID);
		};
	};
};

// code editor
function WCodeEdit(cpu, rom, mem, ctrl, term, height) {
	this.cpu = cpu;
	this.rom = rom;
	this.ctrl = ctrl;
	this.term = term;
	this.code = '';
	this.div = document.createElement('table');
	let row = document.createElement('tr');
	let lin = document.createElement('td');
	this.lineform = document.createElement('pre');
	this.linecont = document.createElement('code');
	this.lineform.setAttribute('id', 'line');
	this.lineform.setAttribute('aria-hidden', 'true');
	this.lineform.setAttribute('style', `height: ${height}px`);
	this.linecont.setAttribute('class', 'language-asm6502');
	this.linecont.innerHTML = '1';
	this.lineform.appendChild(this.linecont);
	lin.appendChild(this.lineform);
	let byt = document.createElement('td');
	this.byteform = document.createElement('pre');
	this.bytecont = document.createElement('code');
	this.byteform.setAttribute('id', 'byte');
	this.byteform.setAttribute('aria-hidden', 'true');
	this.byteform.setAttribute('style', `height: ${height}px`);
	this.bytecont.setAttribute('class', 'language-asm6502');
	this.byteform.appendChild(this.bytecont);
	byt.appendChild(this.byteform);
	let pre = document.createElement('td');
	pre.setAttribute('colspan', '3');
	this.textarea = document.createElement('textarea');
	this.codeform = document.createElement('pre');
	this.codecont = document.createElement('code');
	this.textarea.setAttribute('id', 'edit');
	this.textarea.setAttribute('style', `height: ${height}px`);
	this.textarea.setAttribute('spellcheck', 'false');
	this.textarea.setAttribute('placeholder', 'Enter instructions here...');
	this.codeform.setAttribute('id', 'high');
	this.codeform.setAttribute('style', `height: ${height}px`);
	this.codeform.setAttribute('aria-hidden', 'true');
	this.codecont.setAttribute('class', 'language-asm6502');
	this.codeform.appendChild(this.codecont);
	let f_update = function(evt, cc, lf, lc) {
		let text = evt.target.value;
		if (text[text.length - 1] == '\n')
			text += ' ';
		cc.innerHTML = text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
		let count = text.split('\n').length;
		Prism.highlightElement(cc);
		let lines = '';
		for (let i = 0; i < count; i++)
			lines += `${i + 1}\n`;
		lc.innerHTML = lines;
	};
	let f_scroll = function(evt, ta, cf, lf, bf) {
		cf.scrollLeft = ta.scrollLeft;
		cf.scrollTop = ta.scrollTop;
		lf.scrollTop = ta.scrollTop;
		bf.scrollTop = ta.scrollTop;
	};
	let f_tab = function(evt, cc, lf, lc) {
		let ta = evt.target;
		let text = ta.value;
		if (evt.key === 'Tab') {
			evt.preventDefault();
			let bef = text.slice(0, ta.selectionStart);
			let aft = text.slice(ta.selectionEnd);
			let cur = ta.selectionEnd + 1;
			ta.value = bef + '\t' + aft;
			ta.selectionStart = cur;
			ta.selectionEnd = cur;
			f_update(evt, cc, lf, lc);
		};
	};
	let f_comb = function(evt, cc, cf, lc, lf, bf) {
		f_update(evt, cc, lf, lc);
		f_scroll(evt, evt.target, cf, lf, bf);
	};
	let textarea = this.textarea;
	let codeform = this.codeform;
	let codecont = this.codecont;
	let lineform = this.lineform;
	let linecont = this.linecont;
	let byteform = this.byteform;
	let bytecont = this.bytecont;
	this.textarea.oninput = (evt) => f_comb(evt, codecont, codeform, linecont, lineform, byteform);
	this.textarea.onscroll = (evt) => f_scroll(evt, textarea, codeform, lineform, byteform);
	this.textarea.onkeydown = (evt) => f_tab(evt, codecont, lineform, linecont);
	pre.appendChild(this.textarea);
	pre.appendChild(this.codeform);
	row.appendChild(lin);
	row.appendChild(pre);
	row.appendChild(byt);
	this.div.appendChild(row);

	// add functions
	let nrow = document.createElement('tr');
	nrow.setAttribute('class', 'fmt-table fmt-user');

	/*let f_load = document.createElement('td');
	f_load.setAttribute('style', 'text-align: center;');
	f_load.setAttribute('class', 'fmt-ctrl');
	f_load.setAttribute('colspan', '2');
	let f_load_inp = document.createElement('input');

	let f_load_btn = document.createElement('button');
	f_load_btn.setAttribute('class', 'fmt-btn');
	f_load_btn.textContent = 'Load';
	f_load_btn.onclick = () => {

	};
	f_load.appendChild(f_load_btn);
	nrow.appendChild(f_load);

	let f_save = document.createElement('td');
	f_save.setAttribute('style', 'width: 0%');
	f_save.setAttribute('class', 'fmt-ctrl');
	let f_save_btn = document.createElement('button');
	f_save_btn.setAttribute('class', 'fmt-btn');
	f_save_btn.textContent = 'Save';
	f_save_btn.onclick = () => {
		
	};
	f_save.appendChild(f_save_btn);
	nrow.appendChild(f_save);*/

	let f_mode = document.createElement('td');
	f_mode.setAttribute('style', 'text-align: center;');
	f_mode.setAttribute('class', 'fmt-ctrl');
	f_mode.setAttribute('colspan', '4');
	let f_mode_label = document.createElement('b');
	f_mode_label.innerHTML = '65C02 Mode';
	let f_mode_tick = document.createElement('input');
	f_mode_tick.setAttribute('type', 'checkbox');
	f_mode_tick.setAttribute('class', 'fmt-tick');
	f_mode_tick.checked = true;
	f_mode.appendChild(f_mode_label);
	f_mode.appendChild(f_mode_tick);
	nrow.appendChild(f_mode);
	let f_asm = document.createElement('td');
	f_asm.setAttribute('style', 'text-align: center;');
	f_asm.setAttribute('class', 'fmt-ctrl');
	let f_asm_btn = document.createElement('button');
	f_asm_btn.setAttribute('class', 'fmt-btn');
	f_asm_btn.textContent = 'Assemble';
	f_asm.appendChild(f_asm_btn);
	nrow.appendChild(f_asm);
	f_asm_btn.onclick = (evt) => {
		let exp = null;
		try {
			exp = wAssemble(textarea.value, !f_mode_tick.checked);
		} catch (error) {
			term.div.innerHTML += `<span class="fmt-err">line ${linenum}: ${error}</span>\n`;
			return;
		};
		for (let i = 0; i < 0x8000; i++)
			rom[i] = exp.rom[i];
		mem.display();
		ctrl.update();
		bytecont.innerHTML = '';
		for (let i = 0; i < exp.info.length; i++) {
			let line = exp.info[i];
			if (line.mode === -2) {
				bytecont.innerHTML += '\n';
				continue;
			};
			if (line.mode === -1) {
				bytecont.innerHTML += `$${wCast(line.start, 16, 4)}: ...\n`;
				continue;
			};
			bytecont.innerHTML += `$${wCast(line.start, 16, 4)}:`;
			for (let j = 0; j < line.size + 1; j++) {
				bytecont.innerHTML += ` $${wCast(rom[(line.start + j) & 0x7FFF], 16, 2)}`;
			};
			bytecont.innerHTML += '\n';
		};
		Prism.highlightElement(bytecont);
	};
	this.div.appendChild(nrow);
};

// cpu controller
function WController(cpu) {
	this.cpu = cpu;
	this.timer = null;
	this.div = document.createElement('table');
	this.div.setAttribute('class', 'fmt-info');
	let r0 = document.createElement('tr');
	let d0 = document.createElement('td');
	d0.innerHTML = `A: $00`;
	r0.appendChild(d0);
	let d1 = document.createElement('td');
	d1.innerHTML = `S: <span style="color: #D24;">$00</span>`;
	d1.onclick = () => {
		this.mem.shift = (this.cpu.s & 0xF0) | 0x100;
		this.mem.display();
	};
	r0.appendChild(d1);
	this.div.appendChild(r0);
	let r1 = document.createElement('tr');
	let d2 = document.createElement('td');
	d2.innerHTML = `X: $00`;
	r1.appendChild(d2);
	let d3 = document.createElement('td');
	d3.innerHTML = `Y: $00`;
	r1.appendChild(d3);
	let r2 = document.createElement('tr');
	let d4 = document.createElement('td');
	d4.innerHTML = `I: <span style="color: #6AC;">$0000</span>`;
	d4.onclick = () => {
		this.mem.shift = this.cpu.i & 0xFFF0;
		this.mem.display();
	};
	r2.appendChild(d4);
	let dc = document.createElement('td');
	dc.innerHTML = `F: Ready`;
	r2.appendChild(dc);
	let r3 = document.createElement('tr');
	let d5 = document.createElement('td');
	d5.setAttribute('colspan', '2');
	d5.innerHTML = `P: $00<pre style="margin: 0; margin-top: 4px;">00000000</pre><pre style="margin:0;">NV-BDIZC</pre>`;
	r3.appendChild(d5);

	let r9 = document.createElement('tr');
	let dh = document.createElement('td');
	dh.setAttribute('colspan', '2');
	dh.innerHTML = `O: $00`;
	r9.appendChild(dh);

	let r4 = document.createElement('tr');
	let d6 = document.createElement('td');
	d6.innerHTML = `IRQ: $0000`;
	r4.appendChild(d6);
	let d7 = document.createElement('td');
	let b0 = document.createElement('button');
	b0.setAttribute('class', 'fmt-btn');
	b0.textContent = 'Trigger IRQ';
	b0.onclick = () => {
		this.cpu.irq();
		this.mem.display();
		this.update();
	};
	d7.appendChild(b0);
	r4.appendChild(d7);

	let r5 = document.createElement('tr');
	let d8 = document.createElement('td');
	d8.innerHTML = `RST: $0000`;
	r5.appendChild(d8);
	let d9 = document.createElement('td');
	let b1 = document.createElement('button');
	b1.setAttribute('class', 'fmt-btn');
	b1.textContent = 'Trigger RST';
	b1.onclick = () => {
		this.term.inp.disabled = true;
		this.term.inp.value = '';
		this.cpu.rst();
		this.mem.display();
		this.update();
	};
	d9.appendChild(b1);
	r5.appendChild(d9);

	let r6 = document.createElement('tr');
	let da = document.createElement('td');
	da.innerHTML = `NMI: $0000`;
	r6.appendChild(da);
	let db = document.createElement('td');
	let b2 = document.createElement('button');
	b2.setAttribute('class', 'fmt-btn');
	b2.textContent = 'Trigger NMI';
	b2.onclick = () => {
		this.cpu.nmi();
		this.mem.display();
		this.update();
	};
	db.appendChild(b2);
	r6.appendChild(db);

	let r7 = document.createElement('tr');
	let dd = document.createElement('td');
	let b3 = document.createElement('button');
	b3.setAttribute('class', 'fmt-btn fmt-btn-width');
	b3.textContent = 'Power';
	b3.onclick = () => {
		this.cpu.a = random();
		this.cpu.x = random();
		this.cpu.y = random();
		this.cpu.s = random();
		this.cpu.p = random() | FLAG_U;
		this.cpu.i = random() | random() << 8;
		this.cpu.f = 1;
		for (let i = 0; i < 0x4000; i++) { if (!(random() & 0x1F)) this.cpu.set(i, random()); else this.cpu.set(i, 0); };
		this.mem.display();
		this.update();
		this.term.inp.disabled = true;
	};
	dd.appendChild(b3);
	r7.appendChild(dd);
	let de = document.createElement('td');
	let b4 = document.createElement('button');
	b4.setAttribute('class', 'fmt-btn fmt-btn-width');
	b4.textContent = 'Step';
	b4.onclick = () => {
		if (!this.cpu.f) {
			this.cpu.tick();
			this.mem.display();
			this.update();
		};
	};
	de.appendChild(b4);
	r7.appendChild(de);

	let r8 = document.createElement('tr');
	let df = document.createElement('td');
	let b5 = document.createElement('button');
	b5.setAttribute('class', 'fmt-btn fmt-btn-width');
	b5.textContent = 'Run';
	b5.onclick = () => {
		this.timer = setInterval(() => {
			for (let i = 0; i < 100; i++) {
				if (this.cpu.f) {
					if (this.cpu.f & 1) {
						clearInterval(this.timer);
						this.mem.display();
						this.update();
						b6.setAttribute('style', 'background-color: #666;');
						b5.setAttribute('style', '');
						return;
					};
					return;
				};
				this.cpu.tick();
			};
			this.mem.display();
			this.update();
		}, 10);
		b5.setAttribute('style', 'background-color: #666;');
		b6.setAttribute('style', '');
	};
	df.appendChild(b5);
	r8.appendChild(df);
	let dg = document.createElement('td');
	let b6 = document.createElement('button');
	b6.setAttribute('class', 'fmt-btn fmt-btn-width');
	b6.textContent = 'Pause';
	b6.onclick = () => {
		clearInterval(this.timer);
		b6.setAttribute('style', 'background-color: #666;');
		b5.setAttribute('style', '');
	};
	b6.setAttribute('style', 'background-color: #666;');
	dg.appendChild(b6);
	r8.appendChild(dg);

	this.div.appendChild(r8);
	this.div.appendChild(r7);
	this.div.appendChild(r0);
	this.div.appendChild(r1);
	this.div.appendChild(r2);
	this.div.appendChild(r9);
	this.div.appendChild(r3);
	this.div.appendChild(r4);
	this.div.appendChild(r5);
	this.div.appendChild(r6);

	this.cont_a = d0;
	this.cont_x = d2;
	this.cont_y = d3;
	this.cont_s = d1;
	this.cont_p = d5;
	this.cont_i = d4;
	this.cont_o = dh;
	this.cont_f = dc;
	this.cont_irq = d6;
	this.cont_rst = d8;
	this.cont_nmi = da;

	this.update();
};

// update cpu info
WController.prototype.update = function() {
	let opc = this.cpu.get(this.cpu.i);
	this.cont_a.innerHTML = `A: $${wCast(this.cpu.a, 16, 2)}`;
	this.cont_s.innerHTML = `S: <span style="color: #D24;">$${wCast(this.cpu.s, 16, 2)}</span>`;
	this.cont_x.innerHTML = `X: $${wCast(this.cpu.x, 16, 2)}`;
	this.cont_y.innerHTML = `Y: $${wCast(this.cpu.y, 16, 2)}`;
	this.cont_i.innerHTML = `I: <span style="color: #6AC;">$${wCast(this.cpu.i, 16, 4)}</span>`;
	this.cont_p.innerHTML = `P: $${wCast(this.cpu.p, 16, 2)}<pre style="margin: 0; margin-top: 4px;">${wCast(this.cpu.p, 2, 8)}</pre><pre style="margin:0;">NV-BDIZC</pre>`;
	this.cont_o.innerHTML = `O: ${wFetchOpcodeMode(this.cpu, this.cpu.i + 1, opc)}`;
	switch (this.cpu.f) {
		case 0: this.cont_f.innerHTML = 'F: Ready';   break;
		case 1: this.cont_f.innerHTML = 'F: Halted';  break;
		case 2: this.cont_f.innerHTML = 'F: Waiting'; break;
		default: this.cont_f.innerHTML = 'F: ???';    break;
	};
	this.cont_irq.innerHTML = `IRQ: $${wCast(this.cpu.getWord(0xFFFA), 16, 4)}`;
	this.cont_rst.innerHTML = `RST: $${wCast(this.cpu.getWord(0xFFFC), 16, 4)}`;
	this.cont_nmi.innerHTML = `NMI: $${wCast(this.cpu.getWord(0xFFFE), 16, 4)}`;
};

// output terminal
function WTerminal(cpu, mem, ctrl) {
	this.div = document.createElement('pre');
	this.div.setAttribute('class', 'fmt-out');
	this.div.innerHTML = '<span style="color: #CCC">Registers:\n\nW $4000 - Output character\nW $4001 - Enable input\nW $4002 - Clear terminal\nW $4003 - Set input buffer position high byte\n\n</style>';
	this.int = document.createElement('table');
	let row = document.createElement('tr');
	let fld = document.createElement('td');
	let inp = document.createElement('input');
	inp.setAttribute('class', 'fmt-input');
	inp.setAttribute('style', 'width: 236px;');
	inp.setAttribute('maxlength', '31');
	inp.setAttribute('disabled', 'true');
	fld.appendChild(inp);
	row.appendChild(fld);
	this.inp = inp;
	let sub = document.createElement('td');
	let btn = document.createElement('button');
	btn.setAttribute('class', 'fmt-btn');
	btn.textContent = 'Send';
	btn.onclick = () => {
		if (!inp.disabled) {
			for (let i = 0; i < 32; i++) {
				let c = inp.value[i];
				if (c === undefined)
					cpu.set(this.dest + i, 0x0);
				else
					cpu.set(this.dest + i, c.charCodeAt(0));
			};
			cpu.irq();
			ctrl.update();
			mem.display();
			inp.disabled = true;
		};
	};
	sub.appendChild(btn);
	row.appendChild(sub);
	this.int.appendChild(row);
	this.btn = document.createElement('button');
	this.btn.setAttribute('class', 'fmt-btn');
	this.btn.setAttribute('style', 'width: 100%');
	this.btn.textContent = 'Clear';
	let div = this.div;
	this.btn.onclick = () => {
		div.innerHTML = '';
	};
	this.dest = 0x0200;
};

// editor tools
function WTools() {
	this.ram = new Uint8Array(0x4000);
	this.rom = new Uint8Array(0x8000);
	let ram = this.ram;
	let rom = this.rom;
	for (let i = 0; i < 0x4000; i++) { if (!(random() & 0x1F)) this.ram[i] = random(); else this.ram[i] = 0; };
	this.cpu = new CPU();
	this.ccu = new WController(this.cpu);
	this.mem = new WMemView(this.cpu, 12);
	this.trm = new WTerminal(this.cpu, this.mem, this.ccu);
	this.edw = new WCodeEdit(this.cpu, this.rom, this.mem, this.ccu, this.trm, 364);
	this.ccu.mem = this.mem;
	this.ccu.term = this.trm;
	this.div = document.createElement('table');
	this.div.setAttribute('style', 'margin-left: auto; margin-right: auto;');
	let g6 = document.createElement('tr');
	let g7 = document.createElement('td');
	let g0 = document.createElement('tr');
	let g1 = document.createElement('td');
	g1.setAttribute('colspan', '2');
	g1.appendChild(this.edw.div);
	g0.appendChild(g1);
	let g2 = document.createElement('tr');
	let g3 = document.createElement('td');
	let g4 = document.createElement('td');
	g4.setAttribute('style', 'width: 268px; height: 0;');
	g3.appendChild(this.mem.div);
	g2.appendChild(g3);
	g4.appendChild(this.ccu.div);
	g2.appendChild(g4);
	g7.appendChild(g0);
	g7.appendChild(g2);
	g6.appendChild(g7);
	let g8 = document.createElement('td');
	let g9 = document.createElement('table');
	let ga = document.createElement('tr');
	let gb = document.createElement('td');
	gb.appendChild(this.trm.div);
	ga.appendChild(gb);
	g9.appendChild(ga);
	let gc = document.createElement('tr');
	let gd = document.createElement('td');
	gd.setAttribute('class', 'fmt-ctrl');
	gd.appendChild(this.trm.int);
	gc.appendChild(gd);
	g9.appendChild(gc);
	let ge = document.createElement('tr');
	let gf = document.createElement('td');
	gf.setAttribute('class', 'fmt-ctrl');
	gf.appendChild(this.trm.btn);
	ge.appendChild(gf);
	g9.appendChild(ge);
	g8.appendChild(g9);
	g6.appendChild(g8);
	this.div.appendChild(g6);
	let terminal = this.trm;
	this.cpu.set = function(addr, data) {
		if (addr < 0x4000)
			ram[addr] = data;
		else if (addr == 0x4000)
			terminal.div.innerHTML += String.fromCharCode(data);
		else if (addr == 0x4001)
			terminal.inp.disabled = false;
		else if (addr == 0x4002)
			terminal.div.innerHTML = '';
		else if (addr == 0x4003)
			terminal.dest = data << 8;
	};
	this.cpu.get = function(addr) {
		if (addr < 0x4000)
			return ram[addr];
		if (addr >= 0x8000)
			return rom[addr & 0x7FFF];
		return 0x0;
	};
	this.mem.display();
};