/**
 * Tiny Arcade catalog
 *
 * Add one object here whenever a new game is published. The home page builds
 * its featured area, filters, search index, counters, and cards from this list.
 */
window.TINY_ARCADE_GAMES = [
  {
    id: "mochi-sky",
    title: {
      en: "Mochi Sky",
      zh: "麻糬星野"
    },
    description: {
      en: "A pastel pixel platformer. Jump, inhale bubble enemies, fire star shots, and reach the rainbow gate.",
      zh: "粉彩像素風橫向卷軸遊戲。跳躍、吸入泡泡怪、發射星彈，最後抵達彩虹星門。"
    },
    path: "./games/mochi-sky/",
    source: "https://github.com/ShemYu/single-page-games/tree/main/games/mochi-sky",
    preview: "./assets/previews/mochi-sky.png",
    previewAlt: {
      en: "Mochi Sky gameplay with a round pink hero in a pastel pixel world",
      zh: "麻糬星野遊戲畫面，粉紅色圓滾滾角色站在粉彩像素世界中"
    },
    genres: ["platformer", "action"],
    tags: ["pixel-art", "cute", "single-player"],
    controls: ["keyboard", "touch"],
    status: "poc",
    featured: true,
    playTime: "5–10 min",
    added: "2026-06-22",
    updated: "2026-06-22"
  }
];
