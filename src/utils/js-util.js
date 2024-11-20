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
