import { describe, it, expect } from "vitest";
import { extractYouTubeVideoId, canonicalYouTubeUrl } from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("extractYouTubeVideoId", () => {
  it("accepts youtube.com/watch?v= in http and https, with and without www", () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYouTubeVideoId(`https://youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYouTubeVideoId(`http://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("accepts m.youtube.com and music.youtube.com", () => {
    expect(extractYouTubeVideoId(`https://m.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(extractYouTubeVideoId(`https://music.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it("accepts youtu.be short links, including with tracking params", () => {
    expect(extractYouTubeVideoId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(extractYouTubeVideoId(`https://youtu.be/${ID}?si=abc123`)).toBe(ID);
  });

  it("accepts /shorts/ and /embed/ paths", () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(extractYouTubeVideoId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
  });

  it("ignores extra query params like list=", () => {
    expect(extractYouTubeVideoId(`https://www.youtube.com/watch?v=${ID}&list=PLxyz&index=3`)).toBe(ID);
  });

  it("round-trips through canonicalYouTubeUrl", () => {
    const canonical = canonicalYouTubeUrl(ID);
    expect(canonical).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(extractYouTubeVideoId(canonical)).toBe(ID);
  });

  it("rejects non-URL strings", () => {
    expect(extractYouTubeVideoId("not a url")).toBeNull();
    expect(extractYouTubeVideoId("")).toBeNull();
  });

  it("rejects non-http(s) schemes", () => {
    expect(extractYouTubeVideoId(`javascript:alert(1)`)).toBeNull();
  });

  it("rejects other domains", () => {
    expect(extractYouTubeVideoId("https://vimeo.com/12345")).toBeNull();
    expect(extractYouTubeVideoId("https://soundcloud.com/artist/track")).toBeNull();
  });

  it("rejects lookalike hostnames", () => {
    expect(extractYouTubeVideoId(`https://youtube.com.evil.net/watch?v=${ID}`)).toBeNull();
    expect(extractYouTubeVideoId(`https://evil-youtu.be/${ID}`)).toBeNull();
    expect(extractYouTubeVideoId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull();
  });

  it("rejects malformed video IDs", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull(); // 5 chars
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=toolongvideoid123")).toBeNull(); // 18 chars
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=has space!")).toBeNull();
  });

  it("rejects a playlist URL with no video id", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/playlist?list=PLxyz")).toBeNull();
  });

  it("rejects a bare watch URL missing v=", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch")).toBeNull();
  });
});
