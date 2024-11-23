export function formatSymbol(symbol) {
	return symbol.replaceAll("_"," ");
}

function isPlainObject(value) {
    if (!value)
        return false;

    if (value.constructor===Object)
        return true;

    if (value.constructor.toString().includes("Object"))
        return true;

    return false;
}

export function objectifyArgs(params, fields) {
    let conf={}, i=0;

    for (let param of params) {
        if (isPlainObject(param))
            conf={...conf,...param};

        else
        	conf[fields[i++]]=param;
    }

    return conf;
}

export function arrayUnique(a) {
    function onlyUnique(value, index, array) {
        return array.indexOf(value) === index;
    }

    return a.filter(onlyUnique);
}

export function arrayIncludesAll(a, cands) {
    for (let cand of cands)
        if (!a.includes(cand))
            return false;

    return true;
}

export class ResolvablePromise extends Promise {
    constructor(cb = () => {}) {
        let resolveClosure = null;
        let rejectClosure = null;

        super((resolve,reject)=>{
            resolveClosure = resolve;
            rejectClosure = reject;

            return cb(resolve, reject);
        });

        this.resolveClosure = resolveClosure;
        this.rejectClosure = rejectClosure;
    }

    resolve=(result)=>{
        this.resolveClosure(result);
    }

    reject=(reason)=>{
        this.rejectClosure(reason);
    }
}