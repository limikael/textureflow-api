import {vAdd, vSub, vNorm, vCross, vDot, vResolute, vMul, vLen, vNeg} from "../utils/vec.js";

class Triangle {
	constructor(positions) {
		if (positions.length!=9)
			throw new Error("Array length should be 9 for a triangle!");

		this.points=[];
		for (let i=0; i<3; i++)
			this.points.push(positions.slice(i*3,i*3+3));

		if (this.points.length!=3)
			throw new Error("No points!");

		let p=this.points;

		this.min=[
			Math.min(p[0][0],p[1][0],p[2][0]),
			Math.min(p[0][1],p[1][1],p[2][1]),
			Math.min(p[0][2],p[1][2],p[2][2]),
		];

		this.max=[
			Math.max(p[0][0],p[1][0],p[2][0]),
			Math.max(p[0][1],p[1][1],p[2][1]),
			Math.max(p[0][2],p[1][2],p[2][2]),
		];

		let a=vSub(this.points[1],this.points[0]);
		let b=vSub(this.points[2],this.points[0]);

		if ((vLen(a)<=Number.EPSILON) ||
				(vLen(b)<=Number.EPSILON) ||
				(vLen(vSub(vNorm(a),vNorm(b)))<=Number.EPSILON) ||
				(vLen(vSub(vNorm(a),vNeg(vNorm(b))))<=Number.EPSILON))
			this.empty=true;

		if (!this.empty)
			this.getNormal();
	}

	getNormal() {
		if (!this.normal) {
			this.normal=vNorm(vCross(
				vSub(this.points[1],this.points[0]),
				vSub(this.points[2],this.points[0]),
			));

			if (isNaN(this.normal[0]) || 
					isNaN(this.normal[1]) ||
					isNaN(this.normal[2])) {
				console.log("p",vSub(this.points[1],this.points[0]),vSub(this.points[2],this.points[0]));
				throw new Error("Unable to compute normal, empty="+this.isEmpty());
			}
		}

		return this.normal;
	}

	unwrap(sp, sv, tp, tv) {
		if (!sp || !sv || !tp || !tv)
			throw new Error("unwrap: Something is not defined: "+JSON.stringify([sp,sv,tp,tv]));

		this.uv=[];
		for (let i=0; i<3; i++)
			this.uv=[...this.uv,this.unwrapPoint(this.points[i],sp,sv,tp,tv)];
	}

	unwrapFrom(that) {
		if (this.isEmpty())
			throw new Error("unwrapStart: This is empty!");

		if (this.isEmpty())
			throw new Error("unwrapStart: That is empty!");

		if (!that.uv)
			throw new Error("That one is not mapped");

		let thatIndex=[];
		for (let i=0; i<this.points.length; i++) {
			let thati=that.indexOfVertex(this.points[i]);
			if (thati>=0)
				thatIndex.push(thati);
		}

		if (thatIndex.length!=2) {
			console.log(this);
			console.log(that);
			console.log("a1: "+this.isAdjacent(that));
			console.log("a2: "+that.isAdjacent(this));

			throw new Error("Didn't find 2 shared vertices.");
		}

		this.unwrap(
			that.points[thatIndex[0]],
			that.points[thatIndex[1]],
			that.uv[thatIndex[0]],
			that.uv[thatIndex[1]],
		);

		//console.log(thatIndex);
	}

	unwrapEmpty() {
		this.uv=[[0,0],[0,0],[0,0]];
	}

	unwrapStart(size) {
		if (this.isEmpty())
			throw new Error("unwrapStart: It is empty!");

		let v=vSub(this.points[1],this.points[0]);
		let l=vLen(v);

		this.unwrap(this.points[0],this.points[1],[0,0],[l/size,0]);
	}

	unwrapPoint(p, sp, sp2, tp, tp2) {
		if (!p || !sp || !sp2 || !tp || !tp2)
			throw new Error("unwrapPoint: Something is not defined: "+JSON.stringify([p,sp,sp2,tp,tp2]));

		let sv=vSub(sp2,sp);
		let tv=vSub(tp2,tp);

		let svo=vCross(sv,this.getNormal());
		let x=vResolute(sv,vSub(p,sp));
		let y=vResolute(svo,vSub(p,sp));
		let tvo=[-tv[1],tv[0]];
		let q=vAdd(vMul(tv,x),vMul(tvo,y));

		return vAdd(tp,q);
	}

	indexOfVertex(v) {
		for (let i=0; i<this.points.length; i++)
			if (vLen(vSub(this.points[i],v))<=Number.EPSILON)
				return i;

		return -1;
	}

	getAdjacent() {
		if (!this.adjacent) {
			this.adjacent=[];
			for (let t of this.uvUnwrap.triangles)
				if (this.isAdjacent(t) && t!=this)
					this.adjacent.push(t);
		}

		return this.adjacent;
	}

	isAdjacent(that) {
		if (this.max[0]<that.min[0] ||
				this.max[1]<that.min[1] ||
				this.max[2]<that.min[2] ||
				this.min[0]>that.max[0] ||
				this.min[1]>that.max[1] ||
				this.min[2]>that.max[2])
			return false;

		let numClose=0;
		for (let p of this.points)
			if (that.indexOfVertex(p)>=0)
				numClose++;

		return (numClose>=2);
	}

	isEmpty() {
		return this.empty;
		/*return (
			(Math.abs(this.max[0]-this.min[0])<=Number.EPSILON) &&
			(Math.abs(this.max[1]-this.min[1])<=Number.EPSILON) &&
			(Math.abs(this.max[2]-this.min[2])<=Number.EPSILON)
		);*/
	}
}

export default class UvUnwrap {
	constructor(positions, {log}={}) {
		this.log=log;
		if (!this.log)
			this.log=()=>{};

		let numTriangles=positions.length/(3*3);
		this.triangles=[];
		for (let i=0; i<numTriangles; i++) {
			let t=new Triangle(positions.slice(i*9,i*9+9));
			t.uvUnwrap=this;
			this.triangles.push(t);
		}
	}

	getUvs() {
		let a=[];
		for (let t of this.triangles)
			a.push(...t.uv[0],...t.uv[1],...t.uv[2]);

		return a;
	}

	findCandsForNextStep() {
		let cands=[];

		for (let t of this.triangles)
			for (let u of t.getAdjacent())
				if (t!=u &&
						t.uv &&
						!u.uv &&
						!t.isEmpty() &&
						!u.isEmpty()) {
					cands.push({
						from: t,
						to: u,
						dot: vDot(t.getNormal(),u.getNormal())
					})
				}

		return cands;
	}

	findBestCandForNextStep() {
		let cands=this.findCandsForNextStep();
		cands.sort((a,b)=>b.dot-a.dot);
		return cands[0];
	}

	findStart() {
		for (let t of this.triangles)
			if (!t.uv)
				return t;
	}

	unwrap(size) {
		this.log("Unwrapping: "+this.triangles.length);
		this.log("Computing adjacency...");
		let start=Date.now();

		for (let t of this.triangles)
			t.getAdjacent();

		this.log("Adjacency computed: "+(Date.now()-start)/1000);;

		let i=0;
		while (this.findStart() && i<10000) {
			let cand=this.findBestCandForNextStep();
			//console.log(cand);

			if (cand) {
				cand.to.unwrapFrom(cand.from);
			}

			else {
				let t=this.findStart();

				if (t.isEmpty())
					t.unwrapEmpty();

				else
					t.unwrapStart(size);
			}

			i++;
		}

		this.log("Unwrap completed...");

		return this.getUvs();
	}
}