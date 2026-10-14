import assert from "node:assert/strict";import test from "node:test";
import { chromeLabelProfileErrors } from "../lib/qrcode/chrome-print-profile.ts";
const state={mediaSize:{vendor_id:"driver-real-45",width_microns:29000,height_microns:45000},selectedDestinationId:"test-printer",copies:1,marginsType:1,scaling:"100",scalingType:3,isLandscapeEnabled:false,isHeaderFooterEnabled:false};
test("silent preflight rejects seeded dimensions, wrong paper/queue/copies, shrinking, headers and partial batches",()=>{
 assert.deepEqual(chromeLabelProfileErrors(state,"continuous-29x45","test-printer","driver-real-45"),[]);
 for(const patch of [{mediaSize:{width_microns:29000,height_microns:45000}},{mediaSize:{...state.mediaSize,height_microns:12000}},{selectedDestinationId:"other"},{copies:2},{scaling:"95"},{scalingType:2},{marginsType:0},{isLandscapeEnabled:true},{isHeaderFooterEnabled:true},{pagesPerSheet:2},{pageRange:[1]},{ranges:[{from:1,to:1}]}])assert.ok(chromeLabelProfileErrors({...state,...patch},"continuous-29x45","test-printer","driver-real-45").length);
 assert.ok(chromeLabelProfileErrors(state,"die-cut-29x90","test-printer","driver-real-45").length);
});
