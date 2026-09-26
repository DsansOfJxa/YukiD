import axios from 'axios';

class Pinterest {
	constructor() {
		this.origin = 'https://www.pinterest.com';
		this.endpoint = `${this.origin}/resource/BaseSearchResource/get/`;
	}

	async search(query, limit = 20) {
		try {
			if (!query) throw new Error('query is required');

			const maxPages = 2;
			const pageSize = 25;
			let bookmark = null;
			let page = 0;
			let pins = [];

			while (page < maxPages && pins.length < limit) {
				const current = await this.fetchPage({
					query,
					scope: 'pins',
					bookmark,
					pageSize,
				});

				pins.push(...current.results.filter((x) => x?.type === 'pin'));

				if (!current.bookmark) break;

				bookmark = current.bookmark;
				page++;
			}

			const needsVideoLookup = pins.some((pin) => Boolean(pin?.is_video));

			const videoLookup = needsVideoLookup
				? await this.buildVideoLookup(query, maxPages, pageSize)
				: { byId: new Map(), byUrl: new Map() };

			const results = this.uniqueBy(
				pins
					.map((pin) => this.formatPin(pin, videoLookup))
					.filter((item) => {
						if (item.type === 'video') return this.isMp4(item.image); // Map descarga to image
						return Boolean(item.image);
					}),
				(item) => item.url
			).slice(0, limit);

			return results; // Return the array of pins directly to match our standard architecture
		} catch (e) {
			return null;
		}
	}

	async fetchPage({ query, scope, bookmark = null, pageSize = 25 }) {
		const rs = 'typed';
		const sourceUrl = `/search/${scope}/?q=${encodeURIComponent(query)}&rs=${encodeURIComponent(rs)}`;

		const data = {
			options: {
				query,
				scope,
				rs,
				redux_normalize_feed: true,
				source_url: sourceUrl,
				static_feed: false,
				page_size: pageSize,
				...(bookmark ? { bookmarks: [bookmark] } : {}),
			},
			context: {},
		};

		const response = await axios.get(this.endpoint, {
			params: {
				source_url: sourceUrl,
				data: JSON.stringify(data),
				_: Date.now(),
			},
			headers: this.headers(sourceUrl),
			timeout: 20000,
			validateStatus: (s) => s >= 200 && s < 500,
		});

		const rr = response.data?.resource_response;

		if (response.status !== 200 || !rr) {
			throw new Error(`HTTP ${response.status} - ${response.data?.message || 'Request failed'}`);
		}

		if (rr.code !== 0) {
			throw new Error(`Pinterest code ${rr.code}: ${rr.message || 'unknown'}`);
		}

		return {
			bookmark: rr.bookmark && rr.bookmark !== '-end-' ? rr.bookmark : null,
			results: Array.isArray(rr?.data?.results) ? rr.data.results : [],
		};
	}

	headers(sourceUrl) {
		return {
			Accept: 'application/json, text/javascript, */*, q=0.01',
			'X-Requested-With': 'XMLHttpRequest',
			'X-APP-VERSION': '0ddf807',
			'X-Pinterest-AppState': 'active',
			'X-Pinterest-Source-Url': sourceUrl,
			'X-Pinterest-PWS-Handler': 'www/search/[scope].js',
			'screen-dpr': '1.84',
			Referer: `${this.origin}${sourceUrl}`,
			'Accept-Language': 'es-419,es;q=0.9,en;q=0.8',
			'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.163 Mobile Safari/537.36',
		};
	}

	async buildVideoLookup(query, maxPages = 2, pageSize = 25) {
		let bookmark = null;
		let page = 0;

		const byId = new Map();
		const byUrl = new Map();

		while (page < maxPages) {
			const current = await this.fetchPage({
				query,
				scope: 'videos',
				bookmark,
				pageSize,
			});

			for (const pin of current.results) {
				const picked = this.extractVideo(pin);

				if (!picked?.url || !this.isMp4(picked.url)) continue;

				const pinId = String(pin?.id || '').trim();
				const pinUrl = this.pinUrl(pin);

				if (pinId && !byId.has(pinId)) byId.set(pinId, picked.url);
				if (pinUrl && !byUrl.has(pinUrl)) byUrl.set(pinUrl, picked.url);
			}

			if (!current.bookmark) break;

			bookmark = current.bookmark;
			page++;
		}

		return { byId, byUrl };
	}

	formatPin(pin = {}, videoLookup) {
		const pinner = pin.pinner || {};
		const image = this.extractImage(pin);
		const stats = this.reactions(pin);

		const pinId = String(pin?.id || '').trim();
		const url = this.pinUrl(pin);

		const localVideo = this.extractVideo(pin);

		const lookupVideo =
			(pinId && videoLookup?.byId?.get(pinId)) ||
			(url && videoLookup?.byUrl?.get(url)) ||
			null;

		const video =
			(localVideo?.url && this.isMp4(localVideo.url) ? localVideo.url : null) ||
			(lookupVideo && this.isMp4(lookupVideo) ? lookupVideo : null) ||
			null;

		const isVideo = Boolean(video);

		return {
			title: this.clean(pin.title) || this.clean(pin.grid_title),
			name: this.clean(pinner.full_name) || this.clean(pinner.username),
			likes: stats.likes_formateados,
			type: isVideo ? 'video' : 'image',
			url,
			image: isVideo ? video : image, // Standardization with getPinterestData format
		};
	}

	extractImage(pin = {}) {
		const images = pin.images || {};

		return (
			images.orig?.url ||
			images['736x']?.url ||
			images['474x']?.url ||
			images['236x']?.url ||
			images['170x']?.url ||
			null
		);
	}

	extractVideo(pin = {}) {
		const direct = this.pickVideo(pin?.videos?.video_list);
		if (direct) return direct;

		const pages = [
			...(Array.isArray(pin?.story_pin_data?.pages) ? pin.story_pin_data.pages : []),
			...(Array.isArray(pin?.story_pin_data?.pages_preview) ? pin.story_pin_data.pages_preview : []),
		];

		for (const page of pages) {
			const blocks = Array.isArray(page?.blocks) ? page.blocks : [];

			for (const block of blocks) {
				const video = this.pickVideo(block?.video?.video_list);
				if (video) return video;
			}
		}

		return null;
	}

	pickVideo(videoList) {
		if (!videoList || typeof videoList !== 'object') return null;

		const order = ['V_1080P', 'V_720P', 'V_480P', 'V_360P', 'V_240P', 'V_144P'];

		for (const quality of order) {
			const meta = videoList[quality];
			const url = meta?.url;

			if (this.isMp4(url)) {
				return { quality, url, meta };
			}
		}

		const videos = Object.entries(videoList)
			.map(([quality, meta]) => ({
				quality,
				url: meta?.url || null,
				meta,
				width: Number(meta?.width) || 0,
				height: Number(meta?.height) || 0,
				duration: Number(meta?.duration) || 0,
			}))
			.filter((x) => this.isMp4(x.url));

		if (!videos.length) return null;

		videos.sort((a, b) => {
			const areaA = a.width * a.height;
			const areaB = b.width * b.height;

			if (areaB !== areaA) return areaB - areaA;

			return b.duration - a.duration;
		});

		return videos[0];
	}

	reactions(pin = {}) {
		const reactionCounts =
			pin.reaction_counts && typeof pin.reaction_counts === 'object'
				? pin.reaction_counts
				: {};

		const likes =
			Number(reactionCounts['1']) ||
			Number(reactionCounts[1]) ||
			Number(pin.aggregated_pin_data?.reaction_counts?.['1']) ||
			Number(pin.aggregated_pin_data?.reaction_counts?.[1]) ||
			0;

		return {
			likes,
			likes_formateados: this.compact(likes),
		};
	}

	compact(value) {
		const num = Number(value) || 0;

		if (num < 1000) return String(num);

		const units = [
			{ value: 1e9, symbol: 'B' },
			{ value: 1e6, symbol: 'M' },
			{ value: 1e3, symbol: 'k' },
		];

		for (const unit of units) {
			if (num >= unit.value) {
				const short = num / unit.value;

				const formatted = new Intl.NumberFormat('es-HN', {
					minimumFractionDigits: 0,
					maximumFractionDigits: short >= 100 ? 0 : 1,
				}).format(short);

				return `${formatted}${unit.symbol}`;
			}
		}

		return String(num);
	}

	pinUrl(pin = {}) {
		return pin?.id ? `https://www.pinterest.com/pin/${pin.id}/` : null;
	}

	isMp4(url) {
		if (!url) return false;
		return String(url).split('?')[0].toLowerCase().endsWith('.mp4');
	}

	clean(value) {
		if (value == null) return null;

		const text = String(value).trim();

		return text || null;
	}

	uniqueBy(arr, keyFn) {
		const map = new Map();

		for (const item of arr) {
			const key = keyFn(item);

			if (!key || map.has(key)) continue;

			map.set(key, item);
		}

		return [...map.values()];
	}
}

export const scrapePinterest = async (query, limit = 20) => {
    const pinterest = new Pinterest();
    return await pinterest.search(query, limit);
};
