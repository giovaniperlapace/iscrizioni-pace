import assert from "node:assert/strict";import test from "node:test";
import { chromeLabelProfileErrors } from "../lib/qrcode/chrome-print-profile.ts";
const state={mediaSize:{vendor_id:"driver-real-45",width_microns:29000,height_microns:45000},selectedDestinationId:"test-printer",copies:1,marginsType:1,scaling:"100",scalingType:3,isLandscapeEnabled:false,isHeaderFooterEnabled:false};
test("silent preflight rejects seeded dimensions, wrong paper/queue/copies, shrinking, headers and partial batches",()=>{
 assert.deepEqual(chromeLabelProfileErrors(state,"continuous-29x45","test-printer","driver-real-45"),[]);
 for(const patch of [{mediaSize:{width_microns:29000,height_microns:45000}},{mediaSize:{...state.mediaSize,height_microns:12000}},{selectedDestinationId:"other"},{copies:2},{scaling:"95"},{scalingType:2},{marginsType:0},{isLandscapeEnabled:true},{isHeaderFooterEnabled:true},{pagesPerSheet:2},{pageRange:[1]},{ranges:[{from:1,to:1}]}])assert.ok(chromeLabelProfileErrors({...state,...patch},"continuous-29x45","test-printer","driver-real-45").length);
 assert.ok(chromeLabelProfileErrors(state,"die-cut-29x90","test-printer","driver-real-45").length);
});
test("macOS custom paper requires its verified OS definition and exact Chromium point conversion",()=>{
 const paper={name:"DK-22210 29x45 mm",widthPoints:29/25.4*72,heightPoints:45/25.4*72};
 const saved={version:2,recentDestinations:[{id:"test-printer",origin:"local"}],mediaSize:{custom_display_name:paper.name,width_microns:28928,height_microns:44803},marginsType:1,scaling:"100",scalingType:4,isHeaderFooterEnabled:false};
 assert.deepEqual(chromeLabelProfileErrors(saved,"continuous-29x45","test-printer","",paper),[]);
 assert.ok(chromeLabelProfileErrors(saved,"continuous-29x45","test-printer","").length);
 assert.ok(chromeLabelProfileErrors(saved,"continuous-29x45","test-printer","invented",paper).length);
 assert.ok(chromeLabelProfileErrors(saved,"die-cut-29x90","test-printer","",paper).length);
 for(const patch of [{mediaSize:{...saved.mediaSize,width_microns:29000,height_microns:45000}},{mediaSize:{...saved.mediaSize,custom_display_name:"Other"}},{copies:2},{scalingType:1},{scalingType:2},{scaling:"95"},{isLandscapeEnabled:true},{isHeaderFooterEnabled:true},{recentDestinations:[{id:"other",origin:"local"}]},{recentDestinations:[{id:"test-printer",origin:"extension"}]}])assert.ok(chromeLabelProfileErrors({...saved,...patch},"continuous-29x45","test-printer","",paper).length);
 assert.ok(chromeLabelProfileErrors(saved,"continuous-29x45","test-printer","",{...paper,widthPoints:12/25.4*72}).length);
});
