function assertEquals(a, b) {
	if (a!=b)
		throw new Error(`Expected ${a}==${b}`);
}

export function vAdd(a, b) {
	assertEquals(a.length,b.length);
	return a.map((_,i)=>a[i]+b[i]);
}

export function vSub(a, b) {
	assertEquals(a.length,b.length);
	return a.map((_,i)=>a[i]-b[i]);
}

export function vDot(a, b) {
	assertEquals(a.length,b.length);
	return a.map((_,i)=>a[i]*b[i]).reduce((m,n)=>m+n);
}

export function vNeg(v) {
	return v.map(n=>-n);
}

export function vLen(a) {
	return Math.sqrt(a.map(v=>v*v).reduce((m,n)=>m+n));
}

export function vNorm(a) {
	let len=vLen(a);
	return a.map(v=>v/len);
}

export function vCross(a,b) {
	assertEquals(a.length,3);
	assertEquals(a.length,3);
	return [ 
		a[1] * b[2] - a[2] * b[1], 
		a[2] * b[0] - a[0] * b[2], 
		a[0] * b[1] - a[1] * b[0]
	]
}

export function vResolute(direction, v) {
	return (vDot(vNorm(direction),v)/vLen(direction));
}

export function vMul(v, s) {
	return v.map(n=>n*s);
}