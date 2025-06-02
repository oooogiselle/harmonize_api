// utils/mapTrack.js
export default function mapTrack(item) {
  if (!item) {
    console.warn('mapTrack: received null/undefined item');
    return null;
  }

  try {
    // Handle different data structures from Spotify API
    const track = item.track || item;
    
    if (!track) {
      console.warn('mapTrack: no track data found in item:', item);
      return null;
    }

    // Extract basic track info with better fallbacks
    const id = track.id || `temp_${Date.now()}_${Math.random()}`;
    const name = track.name || 'Unknown Track';
    
    // Handle artists array safely
    let artists = [];
    if (track.artists && Array.isArray(track.artists)) {
      artists = track.artists
        .filter(artist => artist && artist.name)
        .map(artist => artist.name);
    } else if (track.artist) {
      // Handle single artist object (could be string or object)
      if (typeof track.artist === 'string') {
        artists = [track.artist];
      } else if (track.artist.name) {
        artists = [track.artist.name];
      }
    }

    // Handle album info safely with multiple fallback strategies
    let image = null;
    let albumName = null;
    
    // Strategy 1: Standard Spotify album structure
    if (track.album) {
      albumName = track.album.name || track.album;
      if (track.album.images && Array.isArray(track.album.images) && track.album.images.length > 0) {
        // Get medium sized image, fallback to largest available
        image = track.album.images.find(img => img.width >= 300)?.url || 
                track.album.images[0]?.url;
      }
    }
    
    // Strategy 2: Direct image properties (fallback)
    if (!image) {
      image = track.image || track.cover || track.artwork || null;
    }
    
    // Strategy 3: Handle cases where album is just a string
    if (!albumName && typeof track.album === 'string') {
      albumName = track.album;
    }

    // Handle preview URL with fallbacks
    const preview_url = track.preview_url || track.preview || null;
    
    // Handle external URLs safely
    const external_urls = track.external_urls || track.externalUrls || {};

    const mappedTrack = {
      id,
      name,
      artists,
      album: albumName,
      image,
      preview_url,
      external_urls,
      // Keep original for debugging but make it safe
      _original: track
    };

    return mappedTrack;
  } catch (error) {
    console.error('mapTrack error:', error, 'Item:', item);
    // Return a safe fallback object instead of null to prevent crashes
    return {
      id: `error_${Date.now()}_${Math.random()}`,
      name: 'Error loading track',
      artists: ['Unknown Artist'],
      album: 'Unknown Album',
      image: null,
      preview_url: null,
      external_urls: {},
      _error: true
    };
  }
}