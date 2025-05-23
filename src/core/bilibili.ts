import md5 from 'md5';
import type { MediaInfo } from "./types";
import { fmt } from './utils';
import { 
    BILI_API,
    biliRequest,
    parseBiliUrl,
    getBiliHeaders,
    generateBiliQRCode,
    checkBiliQRCodeStatus
} from './biliUtils';

// WBI混淆表，用于生成API请求签名
const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
];

/**
 * B站API响应接口
 */
interface BiliApiResponse<T = any> {
    code: number;
    message: string;
    data: T;
}

/**
 * B站视频流响应接口
 */
interface VideoStreamResponse {
    code: number;
    message: string;
    ttl: number;
    data: {
        quality: number;
        format: string;
        timelength: number;
        accept_format: string;
        accept_description: string[];
        accept_quality: number[];
        video_codecid: number;
        seek_param: string;
        seek_type: string;
        durl?: any[];
        dash?: any;
        support_formats: any[];
    };
}

/**
 * B站登录状态接口
 */
interface LoginStatus {
    code: number;
    message: string;
    url?: string;
    refresh_token?: string;
    timestamp?: number;
    userInfo?: {
        face: string;
        level_info: {
            current_level: number;
            current_min: number;
            current_exp: number;
            next_exp: string | number;
        };
        mid: number;
        uname: string;
        wbi_img?: {
            img_url: string;
            sub_url: string;
        };
    };
}

/**
 * B站解析器，处理B站相关API请求和数据解析
 */
export class BilibiliParser {
    /**
     * 混淆密钥生成
     */
    private static mixinKey(orig: string): string {
        return MIXIN_KEY_ENC_TAB.map(n => orig[n]).join('').slice(0, 32);
    }

    /**
     * 签名参数
     */
    private static sign(params: Record<string, any>, imgKey: string, subKey: string): string {
        const key = this.mixinKey(imgKey + subKey);
        params = { ...params, wts: Math.round(Date.now() / 1000) };
        
        const query = Object.keys(params)
            .sort()
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k].toString().replace(/[!'()*]/g, ''))}`)
            .join('&');

        return `${query}&w_rid=${md5(query + key)}`;
    }

    /**
     * 获取WBI密钥
     */
    private static getWbiKeys(config: any): { imgKey: string; subKey: string } {
        const wbiImg = config?.bilibiliLogin?.userInfo?.wbi_img;
        if (!wbiImg) throw new Error('未找到WBI密钥信息');

        return {
            imgKey: wbiImg.img_url.split('/').pop()?.split('.')[0] || '',
            subKey: wbiImg.sub_url.split('/').pop()?.split('.')[0] || ''
        };
    }

    /**
     * 获取视频信息
     */
    static async getVideoInfo(url: string): Promise<MediaInfo | null> {
        const videoId = parseBiliUrl(url);
        if (!videoId) return null;

        try {
            const { p, ...params } = videoId;
            // 获取视频基本信息
            const info = await biliRequest<BiliApiResponse>(`${BILI_API.VIDEO_INFO}?${new URLSearchParams(params).toString()}`);
            if (info.code !== 0) return null;
            
            // 记录UP主ID
            const upMid = info.data.owner?.mid ? String(info.data.owner.mid) : undefined;
            
            // 获取视频分P列表
            const pages = await this.getVideoParts(params);
            
            // 确定当前分P的cid
            let cid = info.data.cid;
            if (pages.length > 0) {
                const pageIndex = Math.min(Math.max(1, p || 1), pages.length) - 1;
                cid = pages[pageIndex].cid;
                
                // 多P视频标题添加分P信息 - 只有当不是第一个分P（索引>0）时才添加
                if (pages.length > 1 && pageIndex > 0) {
                    const part = pages[pageIndex].part;
                    info.data.title = `${info.data.title} - P${pageIndex + 1}${part ? ': ' + part : ''}`;
                }
            }

            // 返回规范化的媒体信息
            return {
                id: `bili-${info.data.bvid}-${cid}`,
                type: 'bilibili',
                url,
                title: info.data.title,
                artist: info.data.owner?.name,
                artistIcon: info.data.owner?.face,
                artistId: upMid,
                duration: fmt(info.data.duration),
                thumbnail: info.data.pic,
                aid: String(info.data.aid),
                bvid: info.data.bvid,
                cid: String(cid)
            };
        } catch (error) {
            console.error('获取视频信息失败:', error);
            return null;
        }
    }

    /**
     * 获取视频分P列表
     */
    static async getVideoParts(params: { aid?: string; bvid?: string }): Promise<any[]> {
        try {
            const response = await biliRequest<BiliApiResponse>(`${BILI_API.VIDEO_PAGES}?${new URLSearchParams(params).toString()}`);
            return response.code === 0 && Array.isArray(response.data) ? response.data : [];
        } catch {
            return [];
        }
    }

    /**
     * 获取视频流
     */
    static async getVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<VideoStreamResponse> {
        const wbiKeys = this.getWbiKeys(config);
        const params = { bvid, cid, qn, fnval: 16, fnver: 0, fourk: 1, platform: 'html5', high_quality: 1 };
        const signedParams = this.sign(params, wbiKeys.imgKey, wbiKeys.subKey);
        const headers = getBiliHeaders(config, bvid);

        const response = await biliRequest<VideoStreamResponse>(
            `${BILI_API.VIDEO_STREAM}?${signedParams}`, headers
        );

        // 解码URL
        if (response.data.dash) {
            if (response.data.dash.video) {
                response.data.dash.video = response.data.dash.video.map(v => ({
                    ...v, baseUrl: decodeURIComponent(v.baseUrl)
                }));
            }
            if (response.data.dash.audio) {
                response.data.dash.audio = response.data.dash.audio.map(a => ({
                    ...a, baseUrl: decodeURIComponent(a.baseUrl)
                }));
            }
        }

        return response;
    }

    /**
     * 获取视频流数据
     */
    static async getProcessedVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<any> {
        const streamData = await this.getVideoStream(bvid, cid, qn, config);
        if (!streamData.data.dash?.video?.length) {
            throw new Error('未找到可用的视频流');
        }
        
        return {
            dash: streamData.data.dash,
            headers: getBiliHeaders(config, bvid)
        };
    }

    /**
     * 获取登录二维码
     */
    static async getLoginQRCode(): Promise<{qrcodeData: string, qrcode_key: string}> {
        return generateBiliQRCode();
    }

    /**
     * 检查二维码扫描状态
     */
    static async checkQRCodeStatus(qrcode_key: string): Promise<LoginStatus> {
        return checkBiliQRCodeStatus(qrcode_key);
    }

    /**
     * 获取收藏夹内容
     * @param mediaId 收藏夹ID
     * @param config 配置信息
     * @returns 收藏夹标题和视频列表
     */
    static async getFavoritesList(mediaId: string, config: any): Promise<{title: string, items: {bvid: string}[]}> {
        try {
            // 并行发送两个请求以提高效率
            const [infoResponse, idsResponse] = await Promise.all([
                // 获取收藏夹信息（标题等）
                biliRequest<BiliApiResponse>(
                    `${BILI_API.FAVORITE_LIST}?media_id=${mediaId}&platform=web&ps=20&pn=1`,
                    getBiliHeaders(config)
                ),
                // 获取收藏夹内容ID列表
                biliRequest<BiliApiResponse>(
                    `${BILI_API.FAVORITE_IDS}?media_id=${mediaId}&platform=web`,
                    getBiliHeaders(config)
                )
            ]);
            
            // 提取收藏夹标题
            const title = infoResponse.data?.info?.title || '未命名收藏夹';
            
            // 过滤出视频类型的项目
            const videoItems = Array.isArray(idsResponse.data) 
                ? idsResponse.data.filter(item => item.type === 2 && item.bvid)
                : [];
            
            return { title, items: videoItems };
        } catch (error) {
            console.error('获取收藏夹内容失败：', error);
            throw error;
        }
    }

    /**
     * 获取用户收藏夹列表
     * @param config 配置信息
     * @returns 收藏夹列表
     */
    static async getUserFavoriteFolders(config: any): Promise<{id: number, title: string, media_count: number}[]> {
        try {
            if (!config.bilibiliLogin?.userInfo?.mid) {
                throw new Error('未登录或无法获取用户信息');
            }
            
            const mid = config.bilibiliLogin.userInfo.mid;
            const response = await biliRequest<BiliApiResponse>(
                `${BILI_API.FAVORITE_FOLDER_LIST}?up_mid=${mid}`,
                getBiliHeaders(config)
            );
            
            if (response.code !== 0 || !Array.isArray(response.data?.list)) {
                return [];
            }
            
            return response.data.list.map(item => ({
                id: item.id,
                title: item.title,
                media_count: item.media_count
            }));
        } catch (error) {
            console.error('获取用户收藏夹列表失败：', error);
            return [];
        }
    }

    /**
     * 获取视频AI总结
     * @param bvid 视频bvid
     * @param cid 视频cid
     * @param upMid UP主mid，可选
     * @param config 配置信息
     * @returns 视频AI总结信息
     */
    static async getVideoAiSummary(bvid: string, cid: string, upMid: string | undefined, config: any): Promise<any> {
        try {
            const params: Record<string, any> = { bvid, cid };
            if (upMid) params.up_mid = upMid;
            
            const wbiKeys = this.getWbiKeys(config);
            const signedParams = this.sign(params, wbiKeys.imgKey, wbiKeys.subKey);
            const headers = getBiliHeaders(config, bvid);

            return await biliRequest<any>(`${BILI_API.VIDEO_AI_SUMMARY}?${signedParams}`, headers);
        } catch (error) {
            console.error('[BiliAPI] 获取视频AI总结失败:', error);
            return { code: -1, message: '获取AI总结失败', data: null };
        }
    }
}