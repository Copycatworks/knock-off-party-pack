// Match to Hatch on the host screen: everyone's eggs, the prompt, the answer
// groups and the hatching. s.game is the screenView() from server/games/match.js.
import { esc, avatar } from '../common.js';
import { egg, eggColors } from '../eggs.js';
import { byId, timer } from './common.js';

/**
 * Every player's egg, in one row. In the reveal (`gain`), eggs that matched
 * shake and their new crack grows in. During a prompt, patch() marks who has answered.
 */
function nest(s, g, { gain = false } = {}) {
  const players = byId(s);
  const colors = eggColors(s);
  return `
    <div class="mh-nest hs-nest" style="--cols:${g.eggs.length}">${g.eggs.map((e) => {
      const p = players.get(e.id);
      return `
        <div class="mh-spot ${p?.connected === false ? 'offline' : ''}" data-id="${e.id}">
          ${egg(e.cracks, g.cracksToHatch, { old: gain ? e.cracks - e.gained : e.cracks, color: colors.get(e.id) })}
          <span class="name">${esc(p?.name ?? '?')}</span>
          <span class="mh-count">${e.cracks}/${g.cracksToHatch}${gain && e.gained ? ' <b>+1</b>' : ''}</span>
        </div>`;
    }).join('')}
    </div>`;
}

/**
 * The intro, prompt and reveal screens share one layout, so the prompt, timer
 * and eggs stay put; only the area below the eggs (`stage`) changes.
 */
const layout = (s, g, { prompt, timer: showTimer = true, gain = false, stage }) => `
  <div class="hs-top">
    <span class="pill">${g.round ? `Round ${g.round}` : 'Get ready'}</span>
    <span class="pill">First to ${g.cracksToHatch} cracks hatches</span>
  </div>
  <div class="card prompt mh-prompt hs-mh-prompt"><span>${prompt}</span></div>
  <div class="timer ${showTimer ? '' : 'mh-hidden'}">
    <div class="timer-bar"><div class="timer-fill" data-timer-fill></div></div>
    <div class="timer-num" data-countdown></div>
  </div>
  ${nest(s, g, { gain })}
  <div class="mh-stage">${stage}</div>`;

const SCREENS = {
  intro: (s, g) => layout(s, g, {
    prompt: 'Match to Hatch',
    timer: false,
    stage: `
      <div class="card hs-rules rise">
        <b>Everyone's pet is in an egg!</b> Give the same answer as <b>anyone</b> else to crack yours.
        No match, no crack. ${g.cracksToHatch} cracks hatches it, and the first to hatch wins!
      </div>`,
  }),

  prompt: (s, g) => layout(s, g, {
    prompt: esc(g.prompt),
    stage: '<p class="hs-say on-bg rise">Answer on your phone! Think like everyone else…</p>',
  }),

  reveal: (s, g) => {
    const players = byId(s);
    const answeredIds = new Set(g.groups.flatMap((gr) => gr.ids));
    const silent = s.players.filter((p) => g.eggs.some((e) => e.id === p.id) && !answeredIds.has(p.id));
    return layout(s, g, {
      prompt: esc(g.prompt),
      gain: true,
      stage: `
        <div class="hs-groups">${g.groups.map((gr, i) => `
          <div class="card mh-group rise ${gr.matched ? 'matched' : 'alone'}" style="animation-delay:${0.25 + i * 0.12}s">
            <span class="said">${esc(gr.answer)}</span>
            <span class="who">${gr.ids.map((id) => players.get(id)).filter(Boolean).map((p) => avatar(p, 'tiny')).join('')}</span>
            <span class="gain">${gr.matched ? '+1 🥚' : '✗'}</span>
          </div>`).join('')}
          ${silent.length ? `
            <div class="card mh-group alone rise" style="animation-delay:${0.25 + g.groups.length * 0.12}s">
              <span class="said">—</span><span class="who">${silent.map((p) => avatar(p, 'tiny')).join('')}</span><span class="gain">✗</span>
            </div>` : ''}
        </div>`,
    });
  },

  hatch: (s, g) => {
    const players = byId(s);
    const colors = eggColors(s);
    const hatched = new Set(g.hatched);
    const names = g.hatched.map((id) => esc(players.get(id)?.name ?? '?'));
    const rest = g.eggs.filter((e) => !hatched.has(e.id)).sort((a, b) => b.cracks - a.cracks);
    return `
      <div class="mh-hatch hs-hatch">
        <div class="burst mh-burst"></div>
        <div class="mh-flash"></div>
        <div class="mh-hatchers ${g.hatched.length > 1 ? 'many' : ''}">${g.hatched.map((id) => `
          <div class="mh-hatcher">
            ${egg(g.cracksToHatch, g.cracksToHatch, { cls: 'hatching', color: colors.get(id) })}
            <div class="mh-pet">${avatar(players.get(id), 'mh-hatchling')}</div>
          </div>`).join('')}
        </div>
        <h1 class="outline-text mega mh-winner">${names.join(' & ')} hatched!</h1>
        <p class="mh-msg mh-winner-sub">First to hatch wins!</p>
        ${rest.length ? `
          <div class="mh-rest">${rest.map((e) => `
            <div class="mh-rest-egg">${egg(e.cracks, g.cracksToHatch, { cls: 'tiny', color: colors.get(e.id) })}
              <span>${esc(players.get(e.id)?.name ?? '?')} · ${e.cracks}/${g.cracksToHatch}</span></div>`).join('')}
          </div>` : ''}
      </div>`;
  },
};

export default {
  id: 'match',

  theme(s) {
    const g = s.game;
    if (g.phase === 'reveal') return 'good';
    if (g.phase === 'hatch') return 'night';
    return 'hatch';
  },

  key: (s) => [s.game.phase, s.game.round].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.timeMs],

  patch(s) {
    if (s.game.phase !== 'prompt') return;
    const answered = new Set(s.game.answered);
    const online = new Map(s.players.map((p) => [p.id, p.connected]));
    for (const spot of document.querySelectorAll('.mh-spot')) {
      spot.classList.toggle('done', answered.has(spot.dataset.id));
      spot.classList.toggle('offline', online.get(spot.dataset.id) === false);
    }
  },
};
