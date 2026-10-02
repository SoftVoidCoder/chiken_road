/* ============================================================================
   skins.js — скины курицы и слоты кастомизации (данные)
   ----------------------------------------------------------------------------
   Курица одна, а скинов много: модель берёт палитру и украшения отсюда.
   Здесь же описаны остальные слоты внешнего вида: питомцы, следы, шапки,
   голоса. Всё покупается за монеты, кроме открываемого за достижения.
   ========================================================================== */
(function (global) {
  'use strict';

  var CC = global.CC;

  /* --- скины курицы: палитра + украшения, всё тоже рисуется кодом ----------- */
  // price — цена в монетах; size — масштаб модели; extra — функция украшений
  var SKINS = [
    { id: 'classic', price: 0, size: 1,
      body: ['#ffffff', '#f4f6fb', '#d9dfea'], wing: '#e3e8f2', tail: ['#eef1f7', '#d7dce7'],
      comb: '#e8453c', beak: '#f5a623', legs: '#f2a33c', eye: '#20242e', line: 'rgba(120,132,155,0.35)', extra: null },
    { id: 'chick', price: 30, size: 0.80,
      body: ['#fff0a8', '#ffd84d', '#eaa900'], wing: '#ffe066', tail: ['#fff3b0', '#ffe066'],
      comb: '#ffb703', beak: '#ff9f1c', legs: '#ff9f1c', eye: '#20242e', line: 'rgba(170,120,20,0.35)', extra: 'fluff' },
    { id: 'bandit', price: 70, size: 1,
      body: ['#f7dcb6', '#e6bd8a', '#c99a63'], wing: '#d9ac78', tail: ['#f0d3ab', '#d9ac78'],
      comb: '#c0392b', beak: '#f5a623', legs: '#e08b2e', eye: '#20242e', line: 'rgba(120,80,40,0.35)', extra: 'bandit' },
    { id: 'ninja', price: 120, size: 1,
      body: ['#4c5468', '#343b4d', '#222738'], wing: '#3d4557', tail: ['#3d4557', '#2a3040'],
      comb: '#e8453c', beak: '#c9ced8', legs: '#c9ced8', eye: '#ffffff', line: 'rgba(10,14,22,0.5)', extra: 'ninja' },
    { id: 'zombie', price: 170, size: 1,
      body: ['#b9d47d', '#93b855', '#6f9339'], wing: '#a3c463', tail: ['#a3c463', '#7d9c46'],
      comb: '#7d9c46', beak: '#c9b458', legs: '#7d9c46', eye: '#ff3b30', line: 'rgba(50,70,25,0.5)', extra: 'zombie' },
    { id: 'robot', price: 230, size: 1,
      body: ['#dbe4ef', '#b3c0d0', '#8b99ab'], wing: '#c3cedd', tail: ['#c3cedd', '#9aa6b6'],
      comb: '#8892a3', beak: '#f2c94c', legs: '#9aa6b6', eye: '#22d3ee', line: 'rgba(50,62,80,0.5)', extra: 'robot' },
    { id: 'gold', price: 300, size: 1,
      body: ['#fff2bb', '#f2c94c', '#b8860b'], wing: '#ffdd77', tail: ['#ffe89a', '#c99a12'],
      comb: '#c1121f', beak: '#ffe066', legs: '#e0a91c', eye: '#5a3d00', line: 'rgba(150,105,0,0.5)', extra: 'gold' },
    { id: 'rainbow', price: 400, size: 1,
      body: null, wing: null, tail: null,
      comb: '#ffffff', beak: '#ffd75e', legs: '#ffd75e', eye: '#1d2b3f', line: 'rgba(40,40,80,0.35)', extra: 'rainbow' }
  ];
  var SKIN_BY_ID = {};
  for (var sk0 = 0; sk0 < SKINS.length; sk0++) { SKIN_BY_ID[SKINS[sk0].id] = SKINS[sk0]; }

  function skinOf(id) { return SKIN_BY_ID[id] || SKINS[0]; }
  // «Радуга» пересчитывает палитру каждый кадр, остальные скины статичны
  function skinColors(sk, t) {
    if (sk.body) { return sk; }
    var h = (t * 70) % 360;
    return {
      size: sk.size, extra: sk.extra, comb: sk.comb, beak: sk.beak, legs: sk.legs,
      eye: sk.eye, line: sk.line,
      body: ['hsl(' + h + ',88%,74%)', 'hsl(' + ((h + 60) % 360) + ',88%,60%)', 'hsl(' + ((h + 120) % 360) + ',82%,48%)'],
      wing: 'hsl(' + ((h + 180) % 360) + ',85%,66%)',
      tail: ['hsl(' + ((h + 240) % 360) + ',88%,76%)', 'hsl(' + ((h + 300) % 360) + ',82%,60%)']
    };
  }


  /* --- дополнительные слоты кастомизации ---------------------------------- */
  // price — цена в монетах, 0 — открыто сразу, unlock — id достижения
  var PETS = [
    { id: 'none',   price: 0,   name: 'pet_none' },
    { id: 'chick',  price: 120, name: 'pet_chick' },
    { id: 'duck',   price: 220, name: 'pet_duck' },
    { id: 'dragon', price: 400, name: 'pet_dragon' }
  ];
  var TRAILS = [
    { id: 'none',    price: 0,   name: 'trail_none', color: null },
    { id: 'feather', price: 90,  name: 'trail_feather', color: '#ffffff' },
    { id: 'spark',   price: 140, name: 'trail_spark', color: '#ffd75e' },
    { id: 'snow',    price: 180, name: 'trail_snow', color: '#dff1ff' },
    { id: 'rainbow', price: 260, name: 'trail_rainbow', color: null },
    { id: 'fire',    price: 300, name: 'trail_fire', color: '#ff8a3d' }
  ];
  var HATS = [
    { id: 'none',    price: 0,   name: 'hat_none' },
    { id: 'cap',     price: 100, name: 'hat_cap' },
    { id: 'crown',   price: 320, name: 'hat_crown' },
    { id: 'helmet',  price: 200, name: 'hat_helmet' },
    { id: 'ushanka', price: 240, name: 'hat_ushanka' }
  ];
  var VOICES = [
    { id: 'classic', price: 0,   name: 'voice_classic' },
    { id: 'squeak',  price: 80,  name: 'voice_squeak' },
    { id: 'robot',   price: 160, name: 'voice_robot' },
    { id: 'duck',    price: 120, name: 'voice_duck' }
  ];

  /* --- бусты: покупаются за монеты или за рекламу -------------------------- */
  var BOOSTS = [
    { id: 'magnet', price: 60,  name: 'boost_magnet', desc: 'boost_magnet_d', dur: 10 },
    { id: 'slow',   price: 80,  name: 'boost_slow',   desc: 'boost_slow_d',   dur: 7 },
    { id: 'shield', price: 100, name: 'boost_shield', desc: 'boost_shield_d', dur: 0 },
    { id: 'double', price: 120, name: 'boost_double', desc: 'boost_double_d', dur: 0 },
    { id: 'mini',   price: 40,  name: 'boost_mini',   desc: 'boost_mini_d',   dur: 15 }
  ];

  function byId(list, id) {
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
    return list[0];
  }

  CC.skins = {
    list: SKINS,
    byId: SKIN_BY_ID,
    skinOf: skinOf,
    colors: skinColors,
    pets: PETS, trails: TRAILS, hats: HATS, voices: VOICES, boosts: BOOSTS,
    pet: function (id) { return byId(PETS, id); },
    trail: function (id) { return byId(TRAILS, id); },
    hat: function (id) { return byId(HATS, id); },
    voice: function (id) { return byId(VOICES, id); },
    boost: function (id) { return byId(BOOSTS, id); }
  };
})(typeof window !== 'undefined' ? window : this);
