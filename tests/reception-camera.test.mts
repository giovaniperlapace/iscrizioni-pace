import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import QRCode from "qrcode";
import sharp from "sharp";
import { startQrCamera, cameraErrorMessage } from "../lib/reception/camera.ts";

const token="a".repeat(43);
async function fixture(t: TestContext, options: { denied?: boolean; delayed?: boolean } = {}) {
  const png=await QRCode.toBuffer(token,{width:320,margin:4,errorCorrectionLevel:"M"});
  const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  let stopped=0;let constraints:unknown;let resolve:(s:unknown)=>void=()=>{};
  const track={stop(){stopped++;},onended:null as null|(()=>void)};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]};
  const video={srcObject:null as unknown,play:async()=>{},readyState:2,videoWidth:320,videoHeight:320} as unknown as HTMLVideoElement;
  const canvas={width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>({data:new Uint8ClampedArray(data),width:info.width,height:info.height})})};
  const originals=["window","document","navigator"].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)] as const);
  Object.defineProperty(globalThis,"window",{configurable:true,value:{isSecureContext:true}});
  Object.defineProperty(globalThis,"document",{configurable:true,value:{createElement:()=>canvas}});
  Object.defineProperty(globalThis,"navigator",{configurable:true,value:{mediaDevices:{getUserMedia:async(c:unknown)=>{
    constraints=c;if(options.denied)throw new DOMException("denied","NotAllowedError");
    return options.delayed?new Promise(r=>{resolve=r;}):stream;
  }}}});
  t.after(()=>{for(const [key,descriptor] of originals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}});
  return {video,track,stream,canvas,get stopped(){return stopped;},get constraints(){return constraints;},resolve:()=>resolve(stream)};
}

test("real decoder reads an opaque PNG frame; abort releases stream, video and canvas",async t=>{
  const f=await fixture(t);const controller=new AbortController();t.after(()=>controller.abort());const codes:string[]=[];
  await startQrCamera({video:f.video,facing:"environment",signal:controller.signal,onCode:v=>codes.push(v),onError:()=>assert.fail("decoder failed")});
  assert.deepEqual(codes,[token]);
  assert.equal((f.constraints as MediaStreamConstraints).audio,false);
  assert.equal(((f.constraints as MediaStreamConstraints).video as MediaTrackConstraints).facingMode && true,true);
  controller.abort();assert.ok(f.stopped>=1);assert.equal(f.video.srcObject,null);assert.equal(f.canvas.width,0);
  await new Promise(r=>setTimeout(r,280));assert.equal(codes.length,1);
});
test("permission accepted after switching away stops every track without decoding",async t=>{
  const f=await fixture(t,{delayed:true});const controller=new AbortController();
  const started=startQrCamera({video:f.video,facing:"user",signal:controller.signal,onCode:()=>assert.fail("late decode"),onError:()=>{}});
  controller.abort();f.resolve();await started;assert.equal(f.stopped,1);assert.equal(f.video.srcObject,null);
});
test("permission rejection is recoverable and hardware-ended stream shuts down",async t=>{
  const f=await fixture(t);const controller=new AbortController();t.after(()=>controller.abort());let errors=0;
  await startQrCamera({video:f.video,facing:"user",signal:controller.signal,onCode:()=>{},onError:()=>{errors++;}});
  f.track.onended!();assert.equal(errors,1);assert.ok(f.stopped>=1);assert.equal(f.video.srcObject,null);
  assert.match(cameraErrorMessage(new DOMException("denied","NotAllowedError")),/non autorizzata/);
  assert.match(cameraErrorMessage(new DOMException("busy","NotReadableError")),/occupata/);
  assert.match(cameraErrorMessage(new DOMException("missing","NotFoundError")),/non trovata/);
});
