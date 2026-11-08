// Match to Hatch on a phone: the answer box and your own egg, which shakes and
// cracks when you match. Everyone's eggs and answers are on the host screen
// (public/js/screens/match.js). `s.game` is the view from server/games/match.js.
import { $, esc, avatar } from '../common.js';
import { egg, eggColors } from '../eggs.js';

const myGroup = (s) => s.game.groups?.find((g) => g.ids.includes(s.you.id));

/** Your egg, with the new crack growing in during the reveal. */
function myEgg(s, g, gain = false) {
  const e = g.eggs.find((x) => x.id === s.you.id);
  if (!e) return '';
  return `
    <div class="mh-me-egg">
      ${egg(e.cracks, g.cracksToHatch, { old: gain ? e.cracks - e.gained : e.cracks, cls: 'solo', color: eggColors(s).get(e.id) })}
      <span class="mh-count">${e.cracks}/${g.cracksToHatch}${gain && e.gained ? ' <b>+1</b>' : ''}</span>
    </div>`;
}

const SCREENS = {
  intro: (s, g) => `
    <h1 class="outline-text mega pop">Match to Hatch</h1>
    ${myEgg(s, g)}
    <div class="card panel center rise d2">
      <p class="big-msg">Your pet is in an egg!</p>
      <p class="sub-msg">Match anyone's answer to crack it. 👀 Watch the screen!</p>
    </div>`,

  prompt: (s, g) => `
    <div class="status-line"><span class="pill">Round ${g.round}</span><span class="pill" data-countdown></span></div>
    <div class="card prompt mh-prompt"><span>${esc(g.prompt)}</span></div>
    ${g.answer !== null ? `
      <div class="card panel center locked rise">
        <p class="big-msg">Locked in!</p>
        <span class="answer">${esc(g.answer)}</span>
        <p class="sub-msg">Hope someone else said it too…</p>
      </div>` : `
      <form class="card panel" id="answer-form" autocomplete="off">
        <input class="input" id="answer-input" maxlength="40" spellcheck="false" placeholder="What will everyone say?">
        <button class="btn go wide" type="submit">Submit</button>
      </form>`}
    ${myEgg(s, g)}`,

  reveal: (s, g) => {
    const mine = myGroup(s);
    return `
      <div class="verdict-row pop">
        <span class="outline-text verdict">${mine?.matched ? 'Match!' : g.answer !== null ? 'No match…' : 'Too slow!'}</span>
      </div>
      ${myEgg(s, g, true)}
      <p class="sub-msg center-text">${mine?.matched ? 'Your egg cracked!' : 'No crack this time.'} 👀 Watch the screen!</p>`;
  },

  hatch: (s, g) => {
    const won = g.hatched.includes(s.you.id);
    const me = s.players.find((p) => p.id === s.you.id);
    return won ? `
      <div class="mh-hatch">
        <div class="burst mh-burst"></div>
        <div class="mh-hatcher"><div class="mh-pet">${avatar(me, 'mh-hatchling')}</div></div>
        <h1 class="outline-text mega mh-winner">You hatched!</h1>
        <p class="mh-msg mh-winner-sub">You win! 🎉</p>
      </div>` : `
      <h1 class="outline-text mega pop">So close!</h1>
      ${myEgg(s, g)}
      <p class="sub-msg center-text">👀 Watch the screen!</p>`;
  },
};

export default {
  id: 'match',
  header: false, // your egg already shows your progress

  theme(s) {
    const g = s.game;
    if (g.phase === 'reveal') return myGroup(s)?.matched ? 'good' : 'bad';
    if (g.phase === 'hatch') return 'night';
    return 'hatch';
  },

  key: (s) => [s.game.phase, s.game.round, s.game.answer !== null].join(':'),

  render: (s) => SCREENS[s.game.phase](s, s.game),

  timer: (s) => [s.game.remainingMs, s.game.timeMs],

  onSubmit(form, send) {
    if (form.id !== 'answer-form') return;
    const value = $('#answer-input').value.trim();
    if (!value) return;
    form.querySelector('button').disabled = true;
    send({ type: 'answer', answer: value });
  },
};
