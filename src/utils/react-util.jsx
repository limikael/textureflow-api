import {useRef, useState, useLayoutEffect, useCallback, cloneElement, useEffect, createElement} from "react";

export function useConstructor(fn) {
	let value=useRef();
	let called=useRef();

	if (!called.current) {
		called.current=true;
		value.current=fn();
	}

	return value.current;
}

export function useEventListener(o, ev, fn) {
	useLayoutEffect(()=>{
		o.addEventListener(ev,fn);
		return ()=>{
			o.removeEventListener(ev,fn);
		}
	},[o,ev,fn]);
}

export function useEventUpdate(o, ev) {
	let [_,setDummyState]=useState();
	let forceUpdate=useCallback(()=>setDummyState({}));
	useEventListener(o,ev,forceUpdate);
}

export function useForceUpdate() {
	let [_,setDummyState]=useState();
	let forceUpdate=useCallback(()=>setDummyState({}));

	return forceUpdate;
}
