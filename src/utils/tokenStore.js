/**
 * Very-simple in-memory token cache.
 * For production you’d likely swap this for Redis or Mongo.
 */

const store = new Map();

/**
 * Save or update a token bundle.
 * @param {string} key   – for example the Mongo `_id` of the user
 * @param {object} value – { access_token, refresh_token, expires_at }
 */
function save(key, value) {
  store.set(key, value);
}

/**
 * Retrieve the token bundle for a user.
 * @param  {string} key
 * @return {object|undefined}
 */
function get(key) {
  return store.get(key);
}

/**
 * Remove cached tokens (e.g. on logout).
 * @param {string} key
 */
function remove(key) {
  store.delete(key);
}

export default { save, get, remove };
