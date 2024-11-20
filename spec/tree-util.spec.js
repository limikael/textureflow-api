import {treePathBasename, treePathDirname} from "../src/utils/tree-util.js";

describe("tree-util",()=>{
	it("can get basename and dirname",async ()=>{
		let basename=treePathBasename("1/2/3");
		expect(basename).toEqual(3);

		let dirname=treePathDirname("1/2/3");
		expect(dirname).toEqual("1/2");

		//console.log("x: "+treePathDirname("1"));
	});
});