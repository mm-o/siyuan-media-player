import md5 from 'md5';
import QRCode from 'qrcode';
import type { MediaInfo, BiliApiResponse } from "./types";
import { Media } from './player';
import { bilibili } from './extensions';

// ===== 1. API配置 - 动态获取 =====
export const getBiliAPI = () => {
    const apis = bilibili.getAPIs();
    return apis ? { PROXY: "/api/network/forwardProxy", ...apis } : null;
};

export const isBilibiliAvailable = () => bilibili.isAvailable();

// ===== 2. 工具函数 =====
export const biliRequest = async <T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
    const api = getBiliAPI();
    if (!api) throw new Error('B站扩展未启用');

    const res = await fetch(api.PROXY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method: 'GET', timeout: 7000, headers: Object.entries(headers).map(([k, v]) => ({ [k]: v })) })
    }).then(r => r.json());

    if (res.code !== 0) throw new Error(`请求失败: ${res.msg}`);
    return JSON.parse(res.data.body);
};

export const getBiliHeaders = (config: any, bvid?: string): Record<string, string> => {
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://www.bilibili.com',
        'Referer': bvid ? `https://www.bilibili.com/video/${bvid}/` : 'https://www.bilibili.com'
    };
    
    const sessdata = config?.settings?.bilibiliLogin?.sessdata;
    if (sessdata) headers['Cookie'] = `SESSDATA=${sessdata}`;
    
    return headers;
};

export const parseBiliUrl = (url: string): { bvid?: string; aid?: string; p?: number } | null => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'b23.tv') return null;
        
        const p = parseInt(urlObj.searchParams.get('p') || '1');
        const bvMatch = urlObj.pathname.match(/\/(BV[\w]+)/);
        if (bvMatch) return { bvid: bvMatch[1], p };
        
        const aid = urlObj.searchParams.get('aid');
        const bvid = urlObj.searchParams.get('bvid');
        return aid ? { aid, p } : bvid ? { bvid, p } : null;
    } catch {
        return null;
    }
};

// ===== 4. 视频处理 =====
export class BilibiliParser {
    private static readonly MIXIN_KEY_ENC_TAB = [46,47,18,2,53,8,23,32,15,50,10,31,58,3,45,35,27,43,5,49,33,9,42,19,29,28,14,39,12,38,41,13,37,48,7,16,24,55,40,61,26,17,0,1,60,51,30,4,22,25,54,21,56,59,6,63,57,62,11,36,20,34,44,52];

    private static sign(params: Record<string, any>, wbiImg: any): string {
        const imgKey = wbiImg.img_url.split('/').pop()?.split('.')[0] || '';
        const subKey = wbiImg.sub_url.split('/').pop()?.split('.')[0] || '';
        const key = this.MIXIN_KEY_ENC_TAB.map(n => (imgKey + subKey)[n]).join('').slice(0, 32);
        
        params = { ...params, wts: Math.round(Date.now() / 1000) };
        const query = Object.keys(params).sort()
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
            .join('&');
        return `${query}&w_rid=${md5(query + key)}`;
    }

    static async getVideoInfo(url: string): Promise<MediaInfo | null> {
        const api = getBiliAPI();
        if (!api) return null;

        const videoId = parseBiliUrl(url);
        if (!videoId) return null;

        try {
            const { p, ...params } = videoId;
            const info = await biliRequest<BiliApiResponse>(`${api.VIDEO_INFO}?${new URLSearchParams(params)}`);
            if (info.code !== 0) return null;

            const pages = await this.getVideoParts(params);
            const pageIndex = pages.length > 0 ? Math.min(Math.max(1, p || 1), pages.length) - 1 : 0;
            const cid = pages.length > 0 ? pages[pageIndex].cid : info.data.cid;

            if (pages.length > 1 && pageIndex > 0) {
                info.data.title = `${info.data.title} - P${pageIndex + 1}${pages[pageIndex].part ? ': ' + pages[pageIndex].part : ''}`;
            }

            return {
                id: `bili-${info.data.bvid}-${cid}`, type: 'bilibili', url, title: info.data.title,
                artist: info.data.owner?.name, artistIcon: info.data.owner?.face, artistId: info.data.owner?.mid?.toString(),
                duration: Media.fmt(info.data.duration), thumbnail: info.data.pic, aid: String(info.data.aid),
                bvid: info.data.bvid, cid: String(cid),
                ...(info.data.ugc_season && { seasonId: String(info.data.ugc_season.id), seasonTitle: info.data.ugc_season.title })
            } as any;
        } catch { return null; }
    }

    static async getVideoParts(params: { aid?: string; bvid?: string }): Promise<any[]> {
        const api = getBiliAPI();
        if (!api) return [];
        try {
            const response = await biliRequest<BiliApiResponse>(`${api.VIDEO_PAGES}?${new URLSearchParams(params)}`);
            return response.code === 0 && Array.isArray(response.data) ? response.data : [];
        } catch { return []; }
    }

    static async getVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<BiliApiResponse> {
        const api = getBiliAPI();
        if (!api) throw new Error('B站扩展未启用');

        const wbiImg = config?.settings?.bilibiliLogin?.wbi_img;
        if (!wbiImg) throw new Error('未找到WBI密钥信息');

        const params = { bvid, cid, qn, fnval: 16, fnver: 0, fourk: 1, platform: 'html5', high_quality: 1 };
        const signedParams = this.sign(params, wbiImg);

        const response = await biliRequest<BiliApiResponse>(`${api.VIDEO_STREAM}?${signedParams}`, getBiliHeaders(config, bvid));
        
        if (response.data.dash) {
            const decodeUrl = (url: string) => decodeURIComponent(url);
            if (response.data.dash.video) {
                response.data.dash.video = response.data.dash.video.map(v => ({...v, baseUrl: decodeUrl(v.baseUrl)}));
            }
            if (response.data.dash.audio) {
                response.data.dash.audio = response.data.dash.audio.map(a => ({...a, baseUrl: decodeUrl(a.baseUrl)}));
            }
        }

        return response;
    }

    static async getProcessedVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<string> {
        const streamData = await this.getVideoStream(bvid, cid, qn, config);
        if (!streamData.data.dash?.video?.length) {
            throw new Error('未找到可用的视频流');
        }
        return createBiliBlobUrl(streamData.data.dash);
    }

    static async getFavoritesList(mediaId: string, config: any): Promise<{title: string, items: {bvid: string}[]}> {
        const api = getBiliAPI();
        if (!api) throw new Error('B站扩展未启用');

        const headers = getBiliHeaders(config);
        const [infoResponse, idsResponse] = await Promise.all([
            biliRequest<BiliApiResponse>(`${api.FAVORITE_LIST}?media_id=${mediaId}&platform=web&ps=20&pn=1`, headers),
            biliRequest<BiliApiResponse>(`${api.FAVORITE_IDS}?media_id=${mediaId}&platform=web`, headers)
        ]);

        return {
            title: infoResponse.data?.info?.title || '未命名收藏夹',
            items: Array.isArray(idsResponse.data) ? idsResponse.data.filter(item => item.type === 2 && item.bvid) : []
        };
    }

    static async getUserFavoriteFolders(config: any): Promise<{id: number, title: string, media_count: number}[]> {
        const api = getBiliAPI();
        if (!api || !config.settings?.bilibiliLogin?.mid) throw new Error('B站扩展未启用或未登录');

        const response = await biliRequest<BiliApiResponse>(
            `${api.FAVORITE_FOLDER_LIST}?up_mid=${config.settings.bilibiliLogin.mid}`,
            getBiliHeaders(config)
        );

        return response.code === 0 && Array.isArray(response.data?.list)
            ? response.data.list.map(({id, title, media_count}) => ({id, title, media_count}))
            : [];
    }

    static async getSeasonArchives(mid: string, seasonId: string, config: any): Promise<{title: string, items: {bvid: string}[]}> {
        const api = getBiliAPI();
        if (!api) throw new Error('B站扩展未启用');

        const response = await biliRequest<BiliApiResponse>(`${api.SEASONS_ARCHIVES_LIST}?mid=${mid}&season_id=${seasonId}&page_num=1&page_size=100`, getBiliHeaders(config));
        return { title: response.data?.meta?.name || '未命名合集', items: response.data?.archives?.map((item: any) => ({bvid: item.bvid})) || [] };
    }

    static async getVideoAiSummary(bvid: string, cid: string, upMid: string | undefined, config: any): Promise<any> {
        const api = getBiliAPI();
        if (!api) return { code: -1, message: 'B站扩展未启用', data: null };

        try {
            const params: Record<string, any> = { bvid, cid };
            if (upMid) params.up_mid = upMid;

            const wbiImg = config?.settings?.bilibiliLogin?.wbi_img;
            if (!wbiImg) throw new Error('未找到WBI密钥信息');

            return await biliRequest<any>(`${api.VIDEO_AI_SUMMARY}?${this.sign(params, wbiImg)}`, getBiliHeaders(config, bvid));
        } catch (error) {
            console.error('[BiliAPI] 获取视频AI总结失败:', error);
            return { code: -1, message: '获取AI总结失败', data: null };
        }
    }
}

// ===== 5. Blob URL生成 =====
const createBiliBlobUrl = (dash: any): string => {
    if (!dash?.video?.length || !dash?.audio?.length) return '';

    try {
        const video = dash.video.find((v: any) => v.id >= 64) || dash.video[0];
        const audio = dash.audio[0];

        if (!video || !audio) return '';

        const duration = Math.floor(dash.duration || 3600);
        const mpd = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" mediaPresentationDuration="PT${duration}S">
 <Period>
  <AdaptationSet mimeType="video/mp4" contentType="video">
   <Representation id="v${video.id}" bandwidth="${video.bandwidth}" codecs="${video.codecs}" width="${video.width}" height="${video.height}">
    <BaseURL>${video.baseUrl}</BaseURL>
    <SegmentBase indexRange="${video.segment_base?.index_range || '0-0'}"><Initialization range="${video.segment_base?.initialization || '0-0'}"/></SegmentBase>
   </Representation>
  </AdaptationSet>
  <AdaptationSet mimeType="audio/mp4" contentType="audio">
   <Representation id="a${audio.id}" bandwidth="${audio.bandwidth}" codecs="${audio.codecs}">
    <BaseURL>${audio.baseUrl}</BaseURL>
    <SegmentBase indexRange="${audio.segment_base?.index_range || '0-0'}"><Initialization range="${audio.segment_base?.initialization || '0-0'}"/></SegmentBase>
   </Representation>
  </AdaptationSet>
 </Period>
</MPD>`;

        const blob = new Blob([mpd], { type: 'application/dash+xml' });
        return URL.createObjectURL(blob);
    } catch {
        return '';
    }
};

// 保持向后兼容
export const createBiliMPD = (dash: any): string => createBiliBlobUrl(dash);

// ===== 6. 登录管理 =====
export class QRCodeManager {
    private timer: number | null = null;
    private qrcodeData = '';
    private qrcodeKey = '';

    constructor(
        private onStatusChange: (status: any) => void,
        private onLoginSuccess: (loginData: any) => void
    ) {}

    async startLogin() {
        const api = getBiliAPI();
        if (!api) throw new Error('B站扩展未启用');

        const res = await biliRequest<any>(api.QR_LOGIN);
        if (res.code !== 0) throw new Error(res.message);

        this.qrcodeData = await QRCode.toDataURL(res.data.url, { width: 200, margin: 2 });
        this.qrcodeKey = res.data.qrcode_key;

        this.onStatusChange({ data: this.qrcodeData, key: this.qrcodeKey, message: '等待扫码' });
        this.startPolling();
    }

    private startPolling() {
        this.stopPolling();
        this.timer = window.setInterval(async () => {
            try {
                const api = getBiliAPI();
                if (!api) return this.stopPolling();

                const res = await biliRequest<any>(`${api.QR_POLL}?qrcode_key=${this.qrcodeKey}`);
                this.onStatusChange({
                    data: this.qrcodeData, key: this.qrcodeKey,
                    message: { 0: '登录成功', 86038: '二维码已过期', 86090: '已扫码，请确认', 86101: '等待扫码' }[res.data.code] || '未知状态'
                });

                if (res.data.code === 0) {
                    this.stopPolling();
                    await this.handleLoginSuccess(res.data);
                } else if (res.data.code === 86038) this.stopPolling();
            } catch { this.stopPolling(); }
        }, 3000);
    }

    private async handleLoginSuccess(data: any) {
        const api = getBiliAPI();
        if (!api) return;

        const sessdata = new URL(data.url).searchParams.get('SESSDATA');
        if (!sessdata) return;

        const userInfo = await biliRequest<any>(api.USER_INFO, {
            'User-Agent': 'Mozilla/5.0',
            'Cookie': `SESSDATA=${sessdata}`
        });
        
        if (userInfo.code === 0 && userInfo.data?.mid) {
            this.onLoginSuccess({
                sessdata,
                refresh_token: data.refresh_token,
                timestamp: data.timestamp,
                mid: userInfo.data.mid,
                uname: userInfo.data.uname,
                face: userInfo.data.face,
                level_info: {
                    current_level: userInfo.data.level_info.current_level,
                    current_exp: userInfo.data.level_info.current_exp,
                    next_exp: userInfo.data.level_info.next_exp
                },
                money: userInfo.data.money,
                vipStatus: userInfo.data.vipStatus,
                wbi_img: userInfo.data.wbi_img
            });
        }
    }

    stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}