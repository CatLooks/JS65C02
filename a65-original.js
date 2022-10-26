/////////////////////////////
///                       ///
///    65C02 Assembler    ///
///    by CatLooks        ///
///    License: MIT       ///
///                       ///
/////////////////////////////

// character matches
function wIsWS(c) { return ' \b\t\n\v\f\r'.includes(c); };
function wIsNL(c) { return '\r\n\f'.includes(c) || c === undefined; };
function wIsDB(c) { return c === '0' || c === '1'; };
function wIsDD(c) { return (c >= '0' && c <= '9'); };
function wIsDH(c) { return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F'); };
function wIsNS(c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c == '.'; };
function wIsOP(c) { return '+-*/%&|^><:#,'.includes(c); };

// check if value is an array
function wIsArr(c) {
	return c.constructor.name === 'Array';
};

// fetch expression in parentheses
function wFetchParentheses(text, i) {
	let s = i + 1;
	let t = 0;
	do {
		let c = text[i++];
		if (c == '(') t++;
		if (c == ')') t--;
		if (wIsNL(c)) {
			throw `unmatched parenthesis due to end of line`; 
		};
		if (t < 0) {
			throw `unexpected closing parenthesis`;
		};
	} while (t);
	return [text.slice(s, i - 1), i];
};

// bound integer
function WInt(value, limit) {
	this.val = value & limit;
	this.lim = limit;
};
function WByte(value) { return new WInt(value, 0xFF  ); };
function WWord(value) { return new WInt(value, 0xFFFF); };
WInt.prototype.add = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt((this.val + wint.val) & lim, lim); };
WInt.prototype.sub = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt((this.val - wint.val) & lim, lim); };
WInt.prototype.mul = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt((this.val * wint.val) & lim, lim); };
WInt.prototype.div = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt(Math.floor(this.val / wint.val) & lim, lim); };
WInt.prototype.mod = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt(this.val % wint.val, lim); };
WInt.prototype.and = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt(this.val & wint.val, lim); };
WInt.prototype.or  = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt(this.val | wint.val, lim); };
WInt.prototype.xor = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt(this.val ^ wint.val, lim); };
WInt.prototype.shr = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt(this.val >> wint.val, lim); };
WInt.prototype.shl = function(wint) { let lim = Math.max(this.lim, wint.lim); return new WInt(this.val << wint.val & lim, lim); };

// perform an operation
function wOperation(a, op, b) {
	if ([typeof(a), typeof(b)].includes('string')) {
		throw `cannot perform operations with strings`;
	};
	switch (op) {
		case '+':  return a.add(b);
		case '-':  return a.sub(b);
		case '*':  return a.mul(b);
		case '/':  return a.div(b);
		case '%':  return a.mod(b);
		case '&':  return a.and(b);
		case '|':  return a.or (b);
		case '^':  return a.xor(b);
		case '>>': return a.shr(b);
		case '<<': return a.shl(b);
		case '>':  return new WInt(b.val >> 0x8, 0xFF);
		case '<':  return new WInt(b.val & 0xFF, 0xFF);
		default:   throw `invalid operator`;
	};
};

// combine operators
function wCombineOperators(a, b) {
	return ['>>', '<<'].includes(a + b);
};

// expression tree node
function WNode() {
	this.L = null; // operand at left
	this.R = null; // operand at right
	this.V = null; // node value (WInt)
};

// compute expression tree node
WNode.prototype.compute = function(scope = {}) {
	// if bottom node, return node value
	if (this.L === null && this.R === null) {
		if (typeof(this.V) == 'object')
			return this.V;
		else if (typeof(this.V) == 'string') {
			if (this.V.startsWith('"'))
				return this.V;
			if (Object.keys(scope).includes(this.V))
				return scope[this.V];
			throw `label '${this.V}' was not defined`;
		};
	};

	// perform operation on children
	if (typeof(this.L) === 'string' || typeof(this.R) === 'string') {
		throw `cannot perform operations with strings`;
	};
	if (this.R === null)
		return wOperation(this.L.compute(scope), this.V);
	return wOperation(this.L.compute(scope), this.V, this.R.compute(scope));
};

// computation operator precedence table
const wPrecedence = {
	'&': 5, '|': 5, '^': 5, '>>': 4, '<<': 4, '+': 3,
	'-': 3, '*': 2, '/': 2, '%' : 2, '>' : 1, '<': 1
};

// tokenize text
function wTokenize(text) {
	let tokens = [];

	// check argument
	if (typeof(text) !== 'string')
		return undefined;

	// parse characters
	let i = 0;
	while (i < text.length) {
		// check for whitespace
		if (wIsWS(text[i])) {
			i++; continue;
		};

		// check for comment
		if (text[i] == ';') {
			// skip until EOL
			while (true) {
				if (wIsNL(text[++i]))
					break;
			};
			i++; continue;
		};

		// check for name
		if (wIsNS(text[i])) {
			tokens.push(text[i++]);

			// fetch the rest of name
			while (true) {
				if (wIsNS(text[i]) || wIsDD(text[i])) {
					tokens[tokens.length - 1] += text[i++];
					continue;
				};
				break;
			};
			continue;
		};

		// check for hex digit
		if (text[i] === '$') {
			let value = 0;
			let digit_count = 0;

			// fetch the number
			while (true) {
				if (wIsDH(text[++i])) {
					value <<= 4;
					digit_count++;
					if (wIsDD(text[i]))
						value |= text[i].charCodeAt(0) & 15;
					else
						value |= (text[i].charCodeAt(0) & 7) + 9;
					continue;
				};
				break;
			};

			// check integer size
			if (digit_count == 0) {
				throw `hex literal must contain at least 1 digit`;
			};
			if (digit_count > 4) {
				throw `number literal must be in word range ($0000 - $FFFF)`;
			};

			// create token
			tokens.push(new WInt(value, digit_count > 2 ? 0xFFFF : 0xFF));
			continue;
		};

		// check for bin digit
		if (text[i] == '%') {
			let value = 0;
			let digit_count = 0;

			// fetch the number
			while (true) {
				if (wIsDB(text[++i])) {
					value <<= 1;
					value |= text[i].charCodeAt(0) & 1;
					digit_count++;
					continue;
				};
				break;
			};

			// check integer size
			if (digit_count == 0) {
				throw `binary literal must contain at least 1 digit`;
			};
			if (digit_count > 16) {
				throw `number literal must be in word range ($0000 - $FFFF)`;
			};

			// create token
			tokens.push(new WInt(value, digit_count > 8 ? 0xFFFF : 0xFF));
			continue;
		};

		// check for dec digit
		if (wIsDD(text[i])) {
			let value = text[i] & 15;

			// fetch the number
			while (true) {
				if (wIsDD(text[++i])) {
					value *= 10;
					value += text[i].charCodeAt(0) & 15;
					continue;
				};
				break;
			};

			// check integer size
			if (value >= 0x10000) {
				throw `number literal must be in word range (0 - 65535)`;
			};

			// create token
			tokens.push(new WInt(value, value >= 0x100 ? 0xFFFF : 0xFF));
			continue;
		};

		// check for parentheses
		if (text[i] == '(') {
			// get inner contents
			let [contents, newI] = wFetchParentheses(text, i);
			i = newI;

			// tokenize contents of parentheses
			let token = wTokenize(contents);
			if (token.length == 0) {
				throw `empty parentheses`;
			};
			tokens.push(token);
			continue;
		};

		// check for operator
		if (wIsOP(text[i])) {
			if (tokens.length && wIsOP(tokens[tokens.length - 1][0])) {
				if (wCombineOperators(tokens[tokens.length - 1], text[i]))
					tokens[tokens.length - 1] += text[i];
				else
					tokens.push(text[i]);
			} else tokens.push(text[i]);
			i++;
			continue;
		};

		// check for character quote
		if (text[i] == '\'') {
			let start = i;

			// skip to the end of string
			while (true) {
				let c = text[++i];
				if (c === '\\') i++;
				if (c === undefined) {
					throw `unexpected end of file while parsing character quotes`;
				};
				if (c === '\'')
					break;
			};

			// create token
			let str = eval(text.slice(start, ++i));
			if (str.length != 1) {
				throw `character quotes must contain 1 character`;
			};
			tokens.push(WByte(str.charCodeAt(0)));
			continue;
		};

		// check for string quote
		if (text[i] == '"') {
			let start = i;

			// skip to the end of string
			while (true) {
				let c = text[++i];
				if (c === '\\') i++;
				if (c === undefined) {
					throw `unexpected end of file while parsing string quotes`;
				};
				if (c === '"')
					break;
			};

			// create token
			let str = text.slice(start, ++i);
			tokens.push('"' + eval(str));
			continue;
		};

		// illegal character
		throw `illegal character '${text[i]}' ($${wCast(text[i].charCodeAt(0), 16, 2)})`;
	};

	// return tokens
	return tokens;
};

// split expression tree
function wSplitExpTree(node) {
	// get latest operator
	let max_value = 0;
	let max_index = 0;
	for (var i = node.V.length - 1; i >= 0; i--) {
		if (node.V[i].prec > max_value) {
			max_value = node.V[i].prec;
			max_index = i;
		};
	};

	// create node branches
	node.L = new WNode();
	node.R = new WNode();
	node.L.V = node.V.slice(0, max_index);
	node.R.V = node.V.slice(max_index + 1);
	node.V = node.V[max_index].token;

	// check for missing operands
	if (node.L.V.length === 0) {
		// check for unary operator
		if (['>', '<'].includes(node.V)) {
			node.L.V = null;
		} else {
			throw `missing left operand of '${node.V}' operator`;
		};
	};
	if (node.R.V.length === 0) {
		throw `missing right operand of '${node.V}' operator`;
	};

	// generate child nodes
	if (node.L.V !== null) {
		if (node.L.V.length === 1)
			node.L.V = node.L.V[0].token;
		else
			wSplitExpTree(node.L);
	};
	if (node.R.V.length === 1)
		node.R.V = node.R.V[0].token;
	else
		wSplitExpTree(node.R);
};

// generate expression tree
function wGenExpTree(tokens) {
	// check for no tokens
	if (tokens.length === 0)
		throw `parsed context is empty`;
	if (tokens.length === 1) {
		if (wIsArr(tokens[0]))
			return wGenExpTree(tokens[0]);
		let root = new WNode();
		root.V = tokens[0];
		return root;
	};

	// bind precedence to each token
	let pairs = [];
	tokens.forEach((token) => {
		pairs.push({ token: token, prec: wPrecedence[token] });
	});

	// create root node
	let root = new WNode();
	root.V = pairs;

	// spit root node
	wSplitExpTree(root);

	// return expression tree
	return root;
};

// assemble code
function wAssemble(text, strict6502 = false) {
	// split into lines
	let lines = text.split('\n');

	// program ROM
	let rom = new Uint8Array(0x8000);

	// filler requests
	let fillers = [];

	// variable definitions
	let defs = {};

	// assembly display info
	let info = [];

	// program pointer
	let ptr = 0x8000;

	// parse each line
	for (let i = 0; i < lines.length; i++) {
		// fetch line
		info.push({ start: ptr, size: 0, mode: 0 });
		linenum = i + 1;
		let line = lines[i];

		// remove comments
		let commentPos = line.indexOf(';');
		if (commentPos !== -1)
			line = line.slice(0, commentPos);

		// tokenize line
		let tks = wTokenize(line);
		let len = tks.length;
		
		// ignore empty lines
		if (len === 0) {
			info[info.length - 1].mode = -2;
			continue;
		};

		// check for opcode
		let opc = tks[0].toLowerCase();
		if (Object.keys(lookup_matrix).includes(opc)) {
			let mode = undefined;
			let size = 0;
			let req = new WNode();
			do {
				let comma = tks.indexOf(',');

				// check for too many arguments
				if (tks.lastIndexOf(',') !== comma) {
					throw `too many arguments`;
				};

				// check for implied mode
				if (len === 1) {
					mode = 0;
					size = 0;
					break;
				};

				// check for accumulator mode
				if (tks[1] === 'a' || tks[1] === 'A') {
					mode = 1;
					size = 0;
					break;
				};

				// check for immediate mode
				if (tks[1] === '#') {
					req = wGenExpTree(tks.slice(2));
					mode = 2;
					size = 1;
					break;
				};

				// check for indirect modes
				if (wIsArr(tks[1])) {
					let commax = tks[1].indexOf(',');
					let commay = tks.indexOf(',');
					let bracks = tks[1];

					// check for too many arguments inside parentheses
					if (tks.lastIndexOf(',') !== commay) {
						throw `too many arguments inside parentheses`;
					};
					if (bracks.lastIndexOf(',') !== commax) {
						throw `too may arguments`;
					};

					// check for indirect under parentheses
					if (tks.length === 2) {
						// check for raw indirect
						if (commax === -1) {
							req = wGenExpTree(bracks);
							mode = opc === 'jmp' ? 12 : 9;
							size = opc === 'jmp' ? 2 : 1;
							break;
						};

						// check for indirect + x
						if (bracks.length - commax === 2 && (bracks[commax + 1] === 'x' || bracks[commax + 1] === 'X')) {
							req = wGenExpTree(bracks.slice(0, commax));
							mode = opc === 'jmp' ? 13 : 10;
							size = opc === 'jmp' ? 2 : 1;
							break;
						};

						// invalid indirect mode
						throw `invalid indirect mode`;
					};

					// check for indirect + y
					if (commax !== -1) {
						throw `parentheses must contain a single argument`;
					};
					if (tks.length - commay === 2 && (tks[commay + 1] === 'y' || tks[commay + 1] === 'Y')) {
						req = wGenExpTree(bracks);
						mode = 11;
						size = 1;
						break;
					};

					// invalid indirect mode
					throw `invalid indirect mode`;
				};

				// check for single absolute mode
				if (comma === -1) {
					req = wGenExpTree(tks.slice(1));

					// check for branch instructions
					if (lookup_matrix[opc][14] !== null) {
						let nreq = new WNode();
						nreq.V = '-';
						nreq.L = req;
						nreq.R = new WNode();
						nreq.R.V = WWord(ptr + 2 & 0xFFFF);
						req = nreq;
						mode = 14;
						size = 1;
						break;
					};

					// try to compute expression
					try {
						let out = req.compute(defs);

						// inherit result's size
						size = out.lim === 0xFF ? 1 : 2;
						mode = 3 + (size - 1) * 3;
					} catch (err) {
						// cast to word
						mode = 6;
						size = 2;
					};
					break;
				};

				// check for + x
				if (tks.length - comma === 2 && (tks[comma + 1] === 'x' || tks[comma + 1] === 'X')) {
					req = wGenExpTree(tks.slice(1, comma));

					// try to compute expression
					try {
						let out = req.compute(defs);

						// inherit result's size
						size = out.lim === 0xFF ? 1 : 2;
						mode = 4 + (size - 1) * 3;
					} catch (err) {
						// cast to word
						mode = 7;
						size = 2;
					};
					break;
				};

				// check for + y
				if (tks.length - comma === 2 && (tks[comma + 1] === 'y' || tks[comma + 1] === 'Y')) {
					req = wGenExpTree(tks.slice(1, comma));

					// try to compute expression
					try {
						let out = req.compute(defs);

						// inherit result's size
						size = out.lim === 0xFF ? 1 : 2;
						mode = 5 + (size - 1) * 3;
					} catch (err) {
						// cast to word
						mode = 8;
						size = 2;
					};
					break;
				};

				// invalid mode
				throw `invalid addressing mode`;
			} while (false);
			
			// write opcode
			let opcID = lookup_matrix[opc][mode];
			if (opcID === null) {
				throw `opcode '${opc}' does not support ${lookup_addr_mode_names[mode]} mode`;
			};
			if (strict6502 && !lookup_6502[opcID]) {
				throw `opcode '${opc}' with ${lookup_addr_mode_names[mode]} mode ($${wCast(opcID, 16, 2)}) is not available in 6502 mode`;
			};
			rom[(ptr++) & 0x7FFF] = opcID;
			info[i].mode = mode;
			info[i].size = size;

			// schedule fill request
			if (mode >= 2 && size > 0)
				fillers.push({ req, mode, ptr, size: size - 1 });
			ptr = ptr + size & 0xFFFF;
			continue;
		};

		// check for macros
		if (opc === '.pos') {
			info[info.length - 1].mode = -2;

			// set file position
			if (tks.includes(',') || tks.length === 1) {
				throw `macro .pos requires 1 argument`;
			};
			ptr = wGenExpTree(tks.slice(1)).compute(defs).val;
			continue;
		};
		if (opc === '.set') {
			info[info.length - 1].mode = -2;

			// set marker
			if (tks.length === 1) {
				throw `macro .set requires at least 2 arguments`;
			};
			let pos = 1;
			let cast = null;
			if (['byte', 'word'].includes(tks[pos].toLowerCase())) {
				cast = tks[pos].toLowerCase() == 'word' ? 1 : 0;
				pos++;
				if (tks.length === 2) {
					throw `static macro .set requires 3 arguments`;
				};
			};
			if (typeof(tks[pos]) !== 'string' || !wIsNS(tks[pos][0])) {
				throw `macro .set requires string-name as label name`;
			};
			defs[tks[pos]] = wGenExpTree(tks.slice(pos + 1)).compute(defs);
			if (cast === 0) {
				defs[tks[pos]].lim = 0xFF;
				defs[tks[pos]].val &= 0xFF;
			} else if (cast === 1) {
				defs[tks[pos]].lim = 0xFFFF;
				defs[tks[pos]].val &= 0xFFFF;
			};
			continue;
		};
		if (opc === '.byte') {
			info[info.length - 1].mode = -1;

			// define bytes
			tks.push(',');
			let prev = 1;
			for (let i = 1; i < tks.length; i++) {
				if (tks[i] == ',') {
					// define byte
					let out = wGenExpTree(tks.slice(prev, i)).compute(defs);
					if (out.constructor.name !== 'WInt') {
						throw `macro .byte requires numbers as arguments`;
					};
					if (out.val >> 8) {
						// cut out warning
					};
					rom[ptr++ & 0x7FFF] = out.val;
					ptr &= 0xFFFF;
					prev = i + 1;
					info[info.length - 1].size++;
				};
			};
			continue;
		};
		if (opc === '.word') {
			info[info.length - 1].mode = -1;

			// define words
			tks.push(',');
			let prev = 1;
			for (let i = 1; i < tks.length; i++) {
				if (tks[i] == ',') {
					// define word
					let out = wGenExpTree(tks.slice(prev, i)).compute(defs);
					if (out.constructor.name !== 'WInt') {
						throw `macro .word requires numbers as arguments`;
					};
					rom[ptr++ & 0x7FFF] = out.val;
					rom[ptr++ & 0x7FFF] = out.val >> 8;
					ptr &= 0xFFFF;
					prev = i + 1;
					info[info.length - 1].size += 2;
				};
			};
			continue;
		};
		if (opc === '.ascii') {
			info[info.length - 1].mode = -1;

			// define text
			tks.push(',');
			let prev = 1;
			for (let i = 1; i < tks.length; i++) {
				if (tks[i] == ',') {
					// define byte
					let out = wGenExpTree(tks.slice(prev, i)).compute(defs);
					if (typeof(out) !== 'string') {
						throw `macro .ascii requires strings as arguments`;
					};
					for (let j = 1; j < out.length; j++)
						rom[ptr++ & 0x7FFF] = out.charCodeAt(j);
					ptr &= 0xFFFF;
					prev = i + 1;
					info[info.length - 1].size += out.length;
				};
			};
			continue;
		};
		if (opc === '.asciiz') {
			info[info.length - 1].mode = -1;

			// define text
			tks.push(',');
			let prev = 1;
			for (let i = 1; i < tks.length; i++) {
				if (tks[i] == ',') {
					// define byte
					let out = wGenExpTree(tks.slice(prev, i)).compute(defs);
					if (typeof(out) !== 'string') {
						throw `macro .asciiz requires strings as arguments`;
					};
					out += '\0';
					for (let j = 1; j < out.length; j++)
						rom[ptr++ & 0x7FFF] = out.charCodeAt(j);
					ptr &= 0xFFFF;
					prev = i + 1;
					info[info.length - 1].size += out.length;
				};
			};
			continue;
		};

		// check for marker
		if (tks.length === 2 && tks[1] === ':') {
			info[info.length - 1].mode = -2;

			// check marker name
			if (!(typeof(tks[0]) === 'string' && wIsNS(tks[0]))) {
				throw `marker name must be a name`;
			};

			// define a marker
			defs[tks[0]] = WWord(ptr);
			continue;
		};

		// illegal keyword
		throw `invalid opcode '${tks[0]}'`;
	};

	// resolve fill requests
	fillers.forEach((fill) => {
		// compute request
		let out = fill.req.compute(defs);

		// check branch distance
		if (fill.mode === 14) {
			if (out.val >= 0x80 && out.val < 0xFF80) {
				throw `relative branch distance (${out.val >= 0x8000 ? out.val - 0x10000 : out.val}) is too far`;
			};
		};

		// fill bytes
		rom[fill.ptr & 0x7FFF] = out.val;
		if (fill.size)
			rom[fill.ptr + 1 & 0x7FFF] = out.val >> 8;
	});

	// export assembled data
	return { rom, defs, info };
};

// addressing modes
const lookup_addr_mode_names = [
	'implied', 'accumulator', 'immediate', 'zeropage', 'zeropage x', 'zeropage y', 'absolute',
	'absolute x', 'absolute y', 'indirect zeropage', 'indirect zeropage x', 'indirect zeropage y',
	'indirect absolute', 'indirect absolute x', 'relative'
];

// instruction opcode matrix
//        IMP   ACC   IMM   ZPG   ZPX   ZPY   ABS   ABX   ABY   IZP   IZX   IZY   IND   IAX   REL
const lookup_matrix = {
	nop: [0xEA, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	brk: [0x00, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	wai: [0xCB, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	stp: [0xDB, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	jam: [0xDB, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	lda: [null, null, 0xA9, 0xA5, 0xB5, null, 0xAD, 0xBD, 0xB9, null, 0xA1, 0xB1, null, null, null],
	ldx: [null, null, 0xA2, 0xA6, null, 0xB6, 0xAE, null, 0xBE, null, null, null, null, null, null],
	ldy: [null, null, 0xA0, 0xA4, 0xB4, null, 0xAC, 0xBC, null, null, null, null, null, null, null],
	sta: [null, null, null, 0x85, 0x95, null, 0x8D, 0x9D, 0x99, 0x92, 0x81, 0x91, null, null, null],
	stx: [null, null, null, 0x86, null, 0x96, 0x8E, null, null, null, null, null, null, null, null],
	sty: [null, null, null, 0x84, 0x94, null, 0x8C, null, null, null, null, null, null, null, null],
	stz: [null, null, null, 0x64, 0x74, null, 0x9C, 0x9E, null, null, null, null, null, null, null],
	and: [null, null, 0x29, 0x25, 0x35, null, 0x2D, 0x3D, 0x39, 0x32, 0x21, 0x31, null, null, null],
	ora: [null, null, 0x09, 0x05, 0x15, null, 0x0D, 0x1D, 0x19, 0x12, 0x01, 0x11, null, null, null],
	eor: [null, null, 0x49, 0x45, 0x55, null, 0x4D, 0x5D, 0x59, 0x52, 0x41, 0x51, null, null, null],
	adc: [null, null, 0x69, 0x65, 0x75, null, 0x6D, 0x7D, 0x79, 0x72, 0x61, 0x71, null, null, null],
	sbc: [null, null, 0xE9, 0xE5, 0xF5, null, 0xED, 0xFD, 0xF9, 0xF2, 0xE1, 0xF1, null, null, null],
	inc: [0x1A, 0x1A, null, 0xE7, 0xF7, null, 0xEE, 0xFE, null, null, null, null, null, null, null],
	dec: [0x3A, 0x3A, null, 0xC7, 0xD7, null, 0xCE, 0xDE, null, null, null, null, null, null, null],
	inx: [0xE8, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	dex: [0xCA, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	iny: [0xC8, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	dey: [0x88, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	jmp: [null, null, null, null, null, null, 0x4C, null, null, null, null, null, 0x6C, 0x7C, null],
	jsr: [null, null, null, null, null, null, 0x20, null, null, null, null, null, null, null, null],
	rts: [0x60, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	rti: [0x40, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	bpl: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0x10],
	bmi: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0x30],
	bvc: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0x50],
	bvs: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0x70],
	bcc: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0x90],
	bcs: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0xB0],
	bne: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0xD0],
	beq: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0xF0],
	bra: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0x80],
	cmp: [null, null, 0xC9, 0xC5, 0xD5, null, 0xCD, 0xDD, 0xD9, 0xD2, 0xC1, 0xD1, null, null, null],
	cpx: [null, null, 0xE0, 0xE4, null, null, 0xEC, null, null, null, null, null, null, null, null],
	cpy: [null, null, 0xC0, 0xC4, null, null, 0xCC, null, null, null, null, null, null, null, null],
	bit: [null, null, 0x89, 0x24, 0x34, null, 0x2C, 0x3C, null, null, null, null, null, null, null],
	tsb: [null, null, null, 0x04, null, null, 0x0C, null, null, null, null, null, null, null, null],
	trb: [null, null, null, 0x14, null, null, 0x1C, null, null, null, null, null, null, null, null],
	php: [0x08, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	plp: [0x28, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	pha: [0x48, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	pla: [0x68, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	phx: [0xDA, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	plx: [0xFA, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	phy: [0x5A, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	ply: [0x7A, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	clc: [0x18, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	sec: [0x38, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	cli: [0x58, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	sei: [0x78, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	cld: [0xD8, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	sed: [0xF8, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	clv: [0xB8, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	tax: [0xAA, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	txa: [0x8A, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	tay: [0xA8, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	tya: [0x98, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	tsx: [0xBA, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	txs: [0x9A, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
	asl: [0x0A, 0x0A, null, 0x06, 0x16, null, 0x0E, 0x1E, null, null, null, null, null, null, null],
	lsr: [0x4A, 0x4A, null, 0x46, 0x56, null, 0x4E, 0x5E, null, null, null, null, null, null, null],
	rol: [0x2A, 0x2A, null, 0x26, 0x36, null, 0x2E, 0x3E, null, null, null, null, null, null, null],
	ror: [0x6A, 0x6A, null, 0x66, 0x76, null, 0x6E, 0x7E, null, null, null, null, null, null, null]
};

// 6502 used opcodes
const lookup_6502 = [
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0,
	1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0,
	0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0,
	1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0,
	1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0,
	1, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0
];