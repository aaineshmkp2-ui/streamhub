/* StreamHub frontend — talks only to our own /api/* endpoints (see /functions/api).
   No TMDB key ever touches the browser. Watchlist/ratings/profiles are stored
   in this browser via localStorage (per-device, no server database). */

const CFG = window.SITE_CONFIG || {};
const IMG = {
  poster: (p, size = "w342") => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null),
  backdrop: (p, size = "w1280") => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null),
  profile: (p, size = "w185") => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null),
  logo: (p, size = "w92") => (p ? `https://image.tmdb.org/t/p/${size}${p}` : null),
};

let GENRE_MAP = []; // [{id,name}]
let state = {
  profiles: [],
  activeProfile: null,
  view: { name: "home" },
  searchQuery: "",
  heroItems: [],
  heroIndex: 0,
  modal: null, // {type,id}
  gateMode: null,
};

const root = document.getElementById("root");

/* ---------------- storage (per-device localStorage) ---------------- */
const LS_KEY = "streamhub_data_v1";
function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : { profiles: [], myList: {}, ratings: {}, progress: {}, activeProfile: null };
  } catch (e) {
    return { profiles: [], myList: {}, ratings: {}, progress: {}, activeProfile: null };
  }
}
function saveLocal(data) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}
let DB = loadLocal();

function persist() { saveLocal(DB); }
function myListIds() { return DB.myList[state.activeProfile] || []; }
function isInList(key) { return myListIds().includes(key); }
function toggleList(item) {
  const key = itemKey(item);
  const list = DB.myList[state.activeProfile] || [];
  const idx = list.findIndex((x) => x.key === key);
  if (idx > -1) { list.splice(idx, 1); toast("Removed from My List"); }
  else { list.push({ key, id: item.id, type: item.media_type || item.type }); toast("Added to My List"); }
  DB.myList[state.activeProfile] = list;
  persist();
  render();
}
function itemKey(item) { return `${item.media_type || item.type}:${item.id}`; }
function myRating(key) { return (DB.ratings[state.activeProfile] || {})[key] || 0; }
function setRating(key, stars) {
  if (!DB.ratings[state.activeProfile]) DB.ratings[state.activeProfile] = {};
  DB.ratings[state.activeProfile][key] = stars;
  persist();
  render();
  toast("Rating saved");
}

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2200);
}

/* ---------------- API layer ---------------- */
async function api(path) {
  const res = await fetch(path);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error || `Request failed: ${path}`);
  return data;
}
async function fetchTrending(type = "all", win = "week") {
  return api(`/api/trending?type=${type}&window=${win}`);
}
async function fetchDiscover(params) {
  const qs = new URLSearchParams(params).toString();
  return api(`/api/discover?${qs}`);
}
async function fetchSearch(q) {
  return api(`/api/search?q=${encodeURIComponent(q)}`);
}
async function fetchDetails(type, id) {
  return api(`/api/details?type=${type}&id=${id}`);
}
async function fetchGenres() {
  const data = await api(`/api/genres`);
  return data.genres || [];
}
function genreIdByName(name) {
  const g = GENRE_MAP.find((x) => x.name === name);
  return g ? g.id : undefined;
}

/* ---------------- rendering helpers ---------------- */
function initials(name) { return (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(); }

function cardEl(item, opts = {}) {
  const div = document.createElement("div");
  div.className = "card";
  const type = item.media_type || item.type || (item.first_air_date ? "tv" : "movie");
  const title = item.title || item.name || "Untitled";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const posterUrl = IMG.poster(item.poster_path || item.backdrop_path);
  if (posterUrl) {
    div.style.backgroundImage = `url(${posterUrl})`;
  } else {
    const ph = document.createElement("div");
    ph.className = "card-placeholder";
    ph.textContent = title;
    div.appendChild(ph);
  }
  div.onclick = () => openModal(type, item.id);
  const shade = document.createElement("div"); shade.className = "card-shade"; div.appendChild(shade);
  const info = document.createElement("div"); info.className = "card-info";
  info.innerHTML = `<div class="t">${title}</div><div class="m"><span>${year || ""}</span><span>${type === "tv" ? "Series" : "Movie"}</span></div>`;
  div.appendChild(info);
  if (opts.progress) {
    const p = document.createElement("div"); p.className = "card-progress";
    p.innerHTML = `<i style="width:${opts.progress}%"></i>`;
    div.appendChild(p);
  }
  return div;
}

function rowEl(title, itemsPromise, opts = {}) {
  const wrap = document.createElement("div"); wrap.className = "row";
  const head = document.createElement("div"); head.className = "row-head";
  head.innerHTML = `<div class="row-title">${title}</div>`;
  wrap.appendChild(head);
  const track = document.createElement("div"); track.className = "row-track";
  const loading = document.createElement("div"); loading.className = "spinner-row"; loading.textContent = "Loading…";
  track.appendChild(loading);
  wrap.appendChild(track);

  itemsPromise.then((items) => {
    track.innerHTML = "";
    if (!items || items.length === 0) {
      track.innerHTML = `<div class="spinner-row">Nothing to show here right now.</div>`;
      return;
    }
    items.forEach((it) => track.appendChild(cardEl(it, opts)));
  }).catch((e) => {
    track.innerHTML = `<div class="spinner-row">Couldn't load this row (${e.message}).</div>`;
  });
  return wrap;
}

function rankRowEl(title, itemsPromise) {
  const wrap = document.createElement("div"); wrap.className = "row";
  const head = document.createElement("div"); head.className = "row-head";
  head.innerHTML = `<div class="row-title">${title}</div>`;
  wrap.appendChild(head);
  const track = document.createElement("div"); track.className = "rank-track";
  track.innerHTML = `<div class="spinner-row">Loading…</div>`;
  wrap.appendChild(track);
  itemsPromise.then((items) => {
    track.innerHTML = "";
    items.slice(0, 10).forEach((it, i) => {
      const w = document.createElement("div"); w.className = "rank-item";
      const num = document.createElement("div"); num.className = "rank-num"; num.textContent = i + 1;
      w.appendChild(num);
      w.appendChild(cardEl(it));
      track.appendChild(w);
    });
  }).catch(() => { track.innerHTML = `<div class="spinner-row">Couldn't load this row.</div>`; });
  return wrap;
}

/* ---------------- Nav ---------------- */
function navEl() {
  const nav = document.createElement("div"); nav.className = "nav";
  const setSolid = () => nav.classList.toggle("solid", window.scrollY > 40 || state.view.name !== "home");
  window.addEventListener("scroll", setSolid); setTimeout(setSolid, 0);

  const left = document.createElement("div"); left.className = "nav-left";
  const logo = document.createElement("div"); logo.className = "logo"; logo.textContent = CFG.siteName || "StreamHub";
  logo.onclick = () => { state.view = { name: "home" }; render(); window.scrollTo(0, 0); };
  left.appendChild(logo);

  const links = document.createElement("div"); links.className = "nav-links";
  [["Home", "home"], ["Movies", "movies"], ["TV Shows", "tv"], ["My List", "mylist"]].forEach(([label, key]) => {
    const b = document.createElement("button"); b.textContent = label;
    if (state.view.name === key) b.classList.add("active");
    b.onclick = () => { state.view = { name: key }; render(); window.scrollTo(0, 0); };
    links.appendChild(b);
  });
  left.appendChild(links);
  nav.appendChild(left);

  const right = document.createElement("div"); right.className = "nav-right";
  const sw = document.createElement("div"); sw.className = "search-wrap";
  const icon = document.createElement("span"); icon.className = "search-icon"; icon.textContent = "⌕";
  const input = document.createElement("input"); input.placeholder = "Search titles...";
  let debounce;
  input.oninput = (e) => {
    state.searchQuery = e.target.value;
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.view = { name: "search" }; render(true); }, 350);
  };
  sw.appendChild(icon); sw.appendChild(input);
  const btn = document.createElement("button"); btn.className = "icon-btn"; btn.textContent = "⌕";
  btn.onclick = () => { sw.classList.toggle("open"); if (sw.classList.contains("open")) input.focus(); };
  right.appendChild(btn); right.appendChild(sw);
  if (state.searchQuery) { sw.classList.add("open"); input.value = state.searchQuery; }

  const profile = DB.profiles.find((p) => p.id === state.activeProfile);
  if (profile) {
    const wrapB = document.createElement("div"); wrapB.style.position = "relative";
    const badge = document.createElement("div"); badge.className = "profile-badge";
    badge.style.background = profile.color; badge.textContent = initials(profile.name);
    badge.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".dropdown").forEach((d) => d.remove());
      const dd = document.createElement("div"); dd.className = "dropdown";
      const sw1 = document.createElement("div"); sw1.className = "dd-item"; sw1.textContent = "Switch profiles";
      sw1.onclick = () => { state.activeProfile = null; render(); };
      const so = document.createElement("div"); so.className = "dd-item"; so.textContent = "Sign out";
      so.onclick = () => { state.activeProfile = null; render(); };
      dd.appendChild(sw1); dd.appendChild(so);
      wrapB.appendChild(dd);
    };
    wrapB.appendChild(badge);
    right.appendChild(wrapB);
  }
  nav.appendChild(right);
  return nav;
}
document.addEventListener("click", () => document.querySelectorAll(".dropdown").forEach((d) => d.remove()));

/* ---------------- Hero ---------------- */
let heroTimer = null;
function heroEl() {
  const wrap = document.createElement("div"); wrap.className = "hero";
  const bootMsg = document.createElement("div"); bootMsg.className = "spinner-row"; bootMsg.textContent = "Loading featured titles…";
  wrap.appendChild(bootMsg);

  fetchTrending("all", "week").then((data) => {
    const items = (data.results || []).filter((r) => (r.backdrop_path) && (r.media_type === "movie" || r.media_type === "tv")).slice(0, CFG.heroCount || 6);
    state.heroItems = items;
    wrap.innerHTML = "";
    if (items.length === 0) { wrap.appendChild(bootMsg); return; }
    items.forEach((item, i) => {
      const slide = document.createElement("div");
      slide.className = "hero-slide" + (i === state.heroIndex ? " active" : "");
      slide.style.backgroundImage = `url(${IMG.backdrop(item.backdrop_path)})`;
      wrap.appendChild(slide);
    });
    wrap.appendChild(Object.assign(document.createElement("div"), { className: "hero-fade-b" }));
    wrap.appendChild(Object.assign(document.createElement("div"), { className: "hero-fade-l" }));

    const item = items[state.heroIndex];
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const content = document.createElement("div"); content.className = "hero-content";
    content.innerHTML = `
      <div class="hero-title">${title}</div>
      <div class="hero-meta"><span class="match">${Math.round((item.vote_average || 0) * 10)}% match</span><span>${year}</span><span class="tag">${item.media_type === "tv" ? "Series" : "Film"}</span></div>
      <div class="hero-desc">${(item.overview || "No description available.")}</div>
    `;
    const actions = document.createElement("div"); actions.className = "hero-actions";
    const infoBtn = document.createElement("button"); infoBtn.className = "btn btn-primary"; infoBtn.innerHTML = "ⓘ More Info";
    infoBtn.onclick = () => openModal(item.media_type, item.id);
    const listBtn = document.createElement("button"); listBtn.className = "btn btn-secondary"; listBtn.innerHTML = "+ My List";
    listBtn.onclick = () => toggleList({ id: item.id, media_type: item.media_type });
    actions.appendChild(infoBtn); actions.appendChild(listBtn);
    content.appendChild(actions);
    wrap.appendChild(content);

    const dots = document.createElement("div"); dots.className = "hero-dots";
    items.forEach((_, i) => {
      const d = document.createElement("div"); d.className = "hero-dot" + (i === state.heroIndex ? " active" : "");
      d.onclick = () => { state.heroIndex = i; render(true); };
      dots.appendChild(d);
    });
    wrap.appendChild(dots);

    clearInterval(heroTimer);
    heroTimer = setInterval(() => { state.heroIndex = (state.heroIndex + 1) % items.length; render(true); }, 7000);
  }).catch((e) => {
    wrap.innerHTML = `<div class="error-banner">Couldn't load featured titles: ${e.message}</div>`;
  });

  return wrap;
}

/* ---------------- Pages ---------------- */
function homeView() {
  const frag = document.createDocumentFragment();
  frag.appendChild(heroEl());
  const rows = document.createElement("div"); rows.className = "rows";

  const progMap = DB.progress[state.activeProfile] || {};
  const progKeys = Object.keys(progMap);
  if (progKeys.length) {
    const items = Promise.all(progKeys.map((k) => {
      const [type, id] = k.split(":");
      return fetchDetails(type, id).then((d) => ({ ...d, media_type: type })).catch(() => null);
    })).then((arr) => arr.filter(Boolean));
    rows.appendChild(rowEl("Continue Watching", items, { progressMap: null }));
  }

  const list = myListIds();
  if (list.length) {
    const items = Promise.all(list.map((x) => fetchDetails(x.type, x.id).then((d) => ({ ...d, media_type: x.type })).catch(() => null)))
      .then((arr) => arr.filter(Boolean));
    rows.appendChild(rowEl("My List", items));
  }

  rows.appendChild(rankRowEl("Top 10 This Week", fetchTrending("all", "week").then((d) => d.results || [])));

  (CFG.rows || []).forEach((rowCfg) => {
    let p;
    if (rowCfg.source === "trending") {
      p = fetchTrending(rowCfg.params.type, rowCfg.params.window).then((d) => d.results || []);
    } else {
      const params = { ...rowCfg.params };
      if (params.genreName) {
        params.genre = genreIdByName(params.genreName);
        delete params.genreName;
      }
      p = fetchDiscover(params).then((d) => (d.results || []).map((r) => ({ ...r, media_type: params.type })));
    }
    rows.appendChild(rowEl(rowCfg.title, p));
  });

  frag.appendChild(rows);
  return frag;
}

function browseView(type) {
  const frag = document.createDocumentFragment();
  const head = document.createElement("div"); head.className = "page-head";
  head.innerHTML = `<div class="page-title">${type === "tv" ? "TV Shows" : "Movies"}</div><div class="page-desc">Browse by genre, live from TMDB</div>`;
  frag.appendChild(head);

  const activeGenre = state.view.genre || "All";
  const bar = document.createElement("div"); bar.className = "filter-bar";
  const names = ["All", ...GENRE_MAP.map((g) => g.name)];
  names.forEach((g) => {
    const chip = document.createElement("div"); chip.className = "chip" + (g === activeGenre ? " active" : "");
    chip.textContent = g;
    chip.onclick = () => { state.view = { name: type, genre: g, page: 1 }; render(); window.scrollTo(0, 0); };
    bar.appendChild(chip);
  });
  frag.appendChild(bar);

  const page = state.view.page || 1;
  const params = { type, sort_by: "popularity.desc", page: String(page) };
  if (activeGenre !== "All") params.genre = genreIdByName(activeGenre);

  const rows = document.createElement("div"); rows.className = "rows"; rows.style.marginTop = "10px";
  const grid = document.createElement("div"); grid.className = "row-track grid-view";
  grid.innerHTML = `<div class="spinner-row">Loading…</div>`;
  rows.appendChild(grid);

  fetchDiscover(params).then((data) => {
    grid.innerHTML = "";
    const items = data.results || [];
    if (items.length === 0) {
      grid.innerHTML = "";
      const e = document.createElement("div"); e.className = "empty-state";
      e.innerHTML = `<div class="big">No titles match this filter</div><div>Try a different genre.</div>`;
      grid.appendChild(e);
      return;
    }
    items.forEach((it) => grid.appendChild(cardEl({ ...it, media_type: type })));
    const more = document.createElement("button"); more.className = "load-more"; more.textContent = "Load more";
    more.onclick = () => {
      more.textContent = "Loading…";
      fetchDiscover({ ...params, page: String(page + 1) }).then((d2) => {
        (d2.results || []).forEach((it) => grid.insertBefore(cardEl({ ...it, media_type: type }), more));
        state.view.page = page + 1;
        more.textContent = "Load more";
      });
    };
    grid.parentElement.appendChild(more);
  }).catch((e) => { grid.innerHTML = `<div class="empty-state">Couldn't load titles: ${e.message}</div>`; });

  frag.appendChild(rows);
  return frag;
}

function myListView() {
  const frag = document.createDocumentFragment();
  const head = document.createElement("div"); head.className = "page-head";
  head.innerHTML = `<div class="page-title">My List</div><div class="page-desc">Titles you've saved to watch</div>`;
  frag.appendChild(head);
  const list = myListIds();
  const rows = document.createElement("div"); rows.className = "rows"; rows.style.marginTop = "10px";
  if (list.length === 0) {
    const e = document.createElement("div"); e.className = "empty-state";
    e.innerHTML = `<div class="big">Your list is empty</div><div>Tap "+ My List" on any title to save it here.</div>`;
    rows.appendChild(e);
  } else {
    const grid = document.createElement("div"); grid.className = "row-track grid-view";
    grid.innerHTML = `<div class="spinner-row">Loading…</div>`;
    Promise.all(list.map((x) => fetchDetails(x.type, x.id).then((d) => ({ ...d, media_type: x.type })).catch(() => null)))
      .then((items) => {
        grid.innerHTML = "";
        items.filter(Boolean).forEach((it) => grid.appendChild(cardEl(it)));
      });
    rows.appendChild(grid);
  }
  frag.appendChild(rows);
  return frag;
}

function searchView() {
  const frag = document.createDocumentFragment();
  const q = (state.searchQuery || "").trim();
  const head = document.createElement("div"); head.className = "page-head";
  head.innerHTML = `<div class="page-title">Search</div><div class="page-desc">${q ? `Results for "${q}"` : "Start typing to search"}</div>`;
  frag.appendChild(head);
  const rows = document.createElement("div"); rows.className = "rows"; rows.style.marginTop = "10px";
  if (q) {
    const grid = document.createElement("div"); grid.className = "row-track grid-view";
    grid.innerHTML = `<div class="spinner-row">Searching…</div>`;
    fetchSearch(q).then((data) => {
      grid.innerHTML = "";
      const items = data.results || [];
      if (items.length === 0) {
        const e = document.createElement("div"); e.className = "empty-state";
        e.innerHTML = `<div class="big">No matches for "${q}"</div>`;
        grid.appendChild(e);
        return;
      }
      items.forEach((it) => grid.appendChild(cardEl(it)));
    }).catch((e) => { grid.innerHTML = `<div class="empty-state">Search failed: ${e.message}</div>`; });
    rows.appendChild(grid);
  }
  frag.appendChild(rows);
  return frag;
}

/* ---------------- Modal ---------------- */
function openModal(type, id) {
  state.modal = { type, id };
  render(true);
}
function closeModal() { state.modal = null; render(true); }

function modalEl() {
  const { type, id } = state.modal;
  const overlay = document.createElement("div"); overlay.className = "modal-overlay";
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  const modal = document.createElement("div"); modal.className = "modal";
  modal.innerHTML = `<div class="spinner-row" style="padding:80px;">Loading title…</div>`;
  overlay.appendChild(modal);

  fetchDetails(type, id).then((item) => {
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || "").slice(0, 4);
    const runtime = type === "movie" ? (item.runtime ? `${Math.floor(item.runtime / 60)}h ${item.runtime % 60}m` : "") : (item.number_of_seasons ? `${item.number_of_seasons} Season${item.number_of_seasons > 1 ? "s" : ""}` : "");
    const key = `${type}:${id}`;
    const inList = isInList(key);

    modal.innerHTML = "";
    const hero = document.createElement("div"); hero.className = "modal-hero";
    const bg = IMG.backdrop(item.backdrop_path) || IMG.poster(item.poster_path);
    if (bg) hero.style.backgroundImage = `url(${bg})`;
    hero.appendChild(Object.assign(document.createElement("div"), { className: "modal-hero-fade" }));
    const close = document.createElement("div"); close.className = "modal-close"; close.textContent = "✕"; close.onclick = closeModal;
    hero.appendChild(close);

    const hc = document.createElement("div"); hc.className = "modal-hero-content";
    hc.innerHTML = `<div class="modal-hero-title">${title}</div>`;
    const actions = document.createElement("div"); actions.className = "modal-actions";
    const trailer = (item.videos?.results || []).find((v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser"));
    if (trailer) {
      const playBtn = document.createElement("button"); playBtn.className = "btn btn-primary"; playBtn.innerHTML = "▶ Play Trailer";
      playBtn.onclick = () => {
        const box = document.createElement("div"); box.style.padding = "0 36px";
        const f = document.createElement("iframe"); f.className = "trailer-frame";
        f.src = `https://www.youtube.com/embed/${trailer.key}?autoplay=1`;
        f.allow = "autoplay; encrypted-media; picture-in-picture"; f.allowFullscreen = true;
        box.appendChild(f);
        modal.querySelector(".modal-hero").after(box);
        playBtn.remove();
        markProgress(key);
      };
      actions.appendChild(playBtn);
    } else {
      const noTrailer = document.createElement("button"); noTrailer.className = "btn btn-secondary"; noTrailer.textContent = "No trailer available"; noTrailer.disabled = true;
      actions.appendChild(noTrailer);
    }
    const listBtn = document.createElement("div"); listBtn.className = "icon-circle" + (inList ? " active" : ""); listBtn.textContent = inList ? "✓" : "+";
    listBtn.title = inList ? "Remove from My List" : "Add to My List";
    listBtn.onclick = () => toggleList({ id, media_type: type });
    actions.appendChild(listBtn);
    hc.appendChild(actions);
    hero.appendChild(hc);
    modal.appendChild(hero);

    const body = document.createElement("div"); body.className = "modal-body";
    const main = document.createElement("div"); main.className = "modal-main";
    const meta = document.createElement("div"); meta.className = "modal-meta-row";
    meta.innerHTML = `<span class="match">${Math.round((item.vote_average || 0) * 10)}% match</span><span>${year}</span><span class="tag">${type === "tv" ? "Series" : "Film"}</span><span>${runtime}</span>`;
    main.appendChild(meta);
    const desc = document.createElement("div"); desc.className = "modal-desc"; desc.textContent = item.overview || "No description available.";
    main.appendChild(desc);

    const rateWrap = document.createElement("div");
    rateWrap.innerHTML = `<div style="font-size:13px;color:var(--text-dim);">Your rating</div>`;
    const rateRow = document.createElement("div"); rateRow.className = "rate-row";
    const cur = myRating(key);
    for (let i = 1; i <= 5; i++) {
      const s = document.createElement("span"); s.className = "star" + (i <= cur ? " filled" : ""); s.textContent = "★";
      s.onclick = () => setRating(key, i === cur ? 0 : i);
      rateRow.appendChild(s);
    }
    rateWrap.appendChild(rateRow);
    main.appendChild(rateWrap);

    const side = document.createElement("div"); side.className = "modal-side";
    const genreNames = (item.genres || []).map((g) => g.name).join(", ");
    side.innerHTML = `<div><b>Genres:</b> ${genreNames || "—"}</div><div><b>Type:</b> ${type === "tv" ? "TV Series" : "Movie"}</div><div><b>Score:</b> ${(item.vote_average || 0).toFixed(1)}/10</div>`;
    const providers = item["watch/providers"]?.results?.[CFG.defaultRegion || "US"];
    if (providers && (providers.flatrate || providers.rent || providers.buy)) {
      const group = providers.flatrate || providers.rent || providers.buy;
      const pRow = document.createElement("div"); pRow.className = "providers-row";
      group.slice(0, 6).forEach((p) => {
        const logo = document.createElement("div"); logo.className = "provider-logo";
        logo.innerHTML = `<img src="${IMG.logo(p.logo_path)}" title="${p.provider_name}">`;
        pRow.appendChild(logo);
      });
      side.appendChild(document.createElement("br"));
      side.appendChild(Object.assign(document.createElement("div"), { innerHTML: "<b>Where to watch:</b>" }));
      side.appendChild(pRow);
      if (providers.link) {
        const link = document.createElement("a"); link.href = providers.link; link.target = "_blank";
        link.style.color = "#4ade80"; link.style.fontSize = "12px"; link.textContent = "View all options →";
        side.appendChild(document.createElement("br")); side.appendChild(link);
      }
    }
    body.appendChild(main); body.appendChild(side);
    modal.appendChild(body);

    const cast = (item.credits?.cast || []).slice(0, 12);
    if (cast.length) {
      const castTitle = document.createElement("div"); castTitle.className = "modal-section-title"; castTitle.textContent = "Cast";
      modal.appendChild(castTitle);
      const castList = document.createElement("div"); castList.className = "cast-list";
      cast.forEach((c) => {
        const el = document.createElement("div"); el.className = "cast-card";
        const photo = IMG.profile(c.profile_path);
        el.innerHTML = `<div class="cast-avatar">${photo ? `<img src="${photo}">` : initials(c.name)}</div><div class="cast-name">${c.name}</div><div class="cast-role">${c.character || ""}</div>`;
        castList.appendChild(el);
      });
      modal.appendChild(castList);
    }

    const similar = (item.similar?.results || []).slice(0, 6);
    if (similar.length) {
      const simTitle = document.createElement("div"); simTitle.className = "modal-section-title"; simTitle.textContent = "More Like This";
      modal.appendChild(simTitle);
      const simGrid = document.createElement("div"); simGrid.className = "similar-grid";
      similar.forEach((it) => simGrid.appendChild(cardEl({ ...it, media_type: type })));
      modal.appendChild(simGrid);
    }
  }).catch((e) => {
    modal.innerHTML = `<div class="error-banner">Couldn't load this title: ${e.message}</div>`;
  });

  return overlay;
}
function markProgress(key) {
  if (!DB.progress[state.activeProfile]) DB.progress[state.activeProfile] = {};
  const cur = DB.progress[state.activeProfile][key] || 0;
  DB.progress[state.activeProfile][key] = Math.min(96, cur + Math.floor(Math.random() * 30) + 15);
  persist();
}

/* ---------------- Profile gate ---------------- */
const AVATAR_COLORS = ["#e50914", "#2a7a8a", "#c49a2e", "#7a4ae0", "#5a8a2a", "#e0602a", "#9a2a6a"];
function gateEl() {
  const wrap = document.createElement("div"); wrap.className = "gate";
  const logo = document.createElement("div"); logo.className = "gate-logo"; logo.textContent = CFG.siteName || "StreamHub";
  wrap.appendChild(logo);

  if (state.gateMode === "create") {
    const title = document.createElement("div"); title.className = "gate-title"; title.textContent = "Create a profile";
    wrap.appendChild(title);
    const form = document.createElement("div"); form.className = "gate-form";
    const input = document.createElement("input"); input.placeholder = "Profile name";
    form.appendChild(input);
    const swatches = document.createElement("div"); swatches.className = "swatches";
    let chosen = AVATAR_COLORS[0];
    AVATAR_COLORS.forEach((c, i) => {
      const s = document.createElement("div"); s.className = "swatch" + (i === 0 ? " sel" : ""); s.style.background = c;
      s.onclick = () => { chosen = c; [...swatches.children].forEach((x) => x.classList.remove("sel")); s.classList.add("sel"); };
      swatches.appendChild(s);
    });
    form.appendChild(swatches);
    const saveBtn = document.createElement("button"); saveBtn.className = "btn btn-primary"; saveBtn.textContent = "Create Profile";
    saveBtn.onclick = () => {
      const name = input.value.trim();
      if (!name) { toast("Enter a name first"); return; }
      const p = { id: "p" + Date.now(), name, color: chosen };
      DB.profiles.push(p);
      state.activeProfile = p.id;
      state.gateMode = null;
      persist();
      render();
    };
    const backBtn = document.createElement("button"); backBtn.className = "btn btn-ghost"; backBtn.textContent = "Back";
    backBtn.onclick = () => { state.gateMode = null; render(); };
    form.appendChild(saveBtn); form.appendChild(backBtn);
    wrap.appendChild(form);
    return wrap;
  }

  const title = document.createElement("div"); title.className = "gate-title"; title.textContent = "Who's watching?";
  wrap.appendChild(title);
  const grid = document.createElement("div"); grid.className = "profile-grid";
  DB.profiles.forEach((p) => {
    const tile = document.createElement("div"); tile.className = "profile-tile";
    tile.innerHTML = `<div class="profile-avatar" style="background:${p.color}">${initials(p.name)}</div><div class="profile-name">${p.name}</div>`;
    tile.onclick = () => { state.activeProfile = p.id; persist(); render(); };
    grid.appendChild(tile);
  });
  const addTile = document.createElement("div"); addTile.className = "profile-tile new-profile";
  addTile.innerHTML = `<div class="profile-avatar">+</div><div class="profile-name">Add Profile</div>`;
  addTile.onclick = () => { state.gateMode = "create"; render(); };
  grid.appendChild(addTile);
  wrap.appendChild(grid);
  return wrap;
}

/* ---------------- Main render ---------------- */
function render() {
  root.innerHTML = "";
  if (!DB.profiles.length || !state.activeProfile) {
    if (!DB.profiles.length) state.gateMode = "create";
    root.appendChild(gateEl());
    return;
  }
  root.appendChild(navEl());
  const main = document.createElement("div");
  if (state.view.name === "home") main.appendChild(homeView());
  else if (state.view.name === "movies") main.appendChild(browseView("movie"));
  else if (state.view.name === "tv") main.appendChild(browseView("tv"));
  else if (state.view.name === "mylist") main.appendChild(myListView());
  else if (state.view.name === "search") main.appendChild(searchView());
  root.appendChild(main);

  const footer = document.createElement("footer");
  footer.innerHTML = `${CFG.siteName || "StreamHub"} — data provided by <a href="https://www.themoviedb.org" target="_blank">TMDB</a>. This product uses the TMDB API but is not endorsed or certified by TMDB.`;
  root.appendChild(footer);

  if (state.modal) root.appendChild(modalEl());
}

/* ---------------- Init ---------------- */
(async function init() {
  try {
    GENRE_MAP = await fetchGenres();
  } catch (e) {
    root.innerHTML = `<div class="error-banner">Couldn't reach the API: ${e.message}<br>Make sure <code>TMDB_API_KEY</code> is set in your Cloudflare Pages project's environment variables, then redeploy.</div>`;
    return;
  }
  render();
})();
