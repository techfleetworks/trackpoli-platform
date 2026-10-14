import { test } from "node:test";
import assert from "node:assert/strict";
import { getSiteInfo } from "./site-info.ts";

test("getSiteInfo returns the site identity", () => {
  const site = getSiteInfo();
  assert.equal(site.name, "TrackPoli");
  assert.ok(site.tagline.length > 0, "tagline is non-empty");
});

test("getSiteInfo lists the four MVP audiences", () => {
  const site = getSiteInfo();
  assert.deepEqual([...site.audiences], [
    "Newbies",
    "Advocates",
    "Citizens",
    "Veterans",
  ]);
});
