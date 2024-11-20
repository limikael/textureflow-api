import path from "path-browserify";

export async function getFileObject(fn,{fs}) {
	let name=path.basename(fn);
	let data=await fs.promises.readFile(fn);
	let file=new File([data],name);
	return file;
}
