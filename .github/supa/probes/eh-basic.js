// A thrown value must reach the nearest catch, directly and through a call.
function boom() { throw new Error('boom'); }
try { throw new Error('direct'); } catch (e) { console.log('caught', e.message); }
try { boom(); } catch (e) { console.log('caught', e.message); }
try { null.x; } catch (e) { console.log('caught', e.constructor.name); }
console.log('done');
