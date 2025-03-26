/**
 * DASH 相关工具类
 */

/**
 * 视频流信息接口
 */
export interface VideoStream {
    video: {
        url: string;        // 视频流地址
        quality: number;    // 视频清晰度
        codecs: string;     // 视频编码格式
        bandwidth: number;  // 视频码率
        frameRate: string;  // 视频帧率
    };
    headers: {             // 请求头信息
        [key: string]: string;
    };
    mpdUrl?: string;      // MPD格式播放地址
}

/**
 * 视频流响应接口
 */
export interface VideoStreamResponse {
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
 * 获取编解码器类型的相关信息
 */
export function getCodecTypeInfo(codec: string): { type: string, description: string } {
    if (!codec) {
        return { type: 'unknown', description: '未知编码' };
    }
    
    codec = codec.toLowerCase();
    
    if (codec.includes('avc') || codec.includes('h264')) {
        return { type: 'h264', description: 'H.264/AVC 视频编码' };
    } else if (codec.includes('hev') || codec.includes('h265') || codec.includes('hevc')) {
        return { type: 'h265', description: 'H.265/HEVC 视频编码' };
    } else if (codec.includes('av1')) {
        return { type: 'av1', description: 'AV1 视频编码' };
    } else if (codec.includes('vp9')) {
        return { type: 'vp9', description: 'VP9 视频编码' };
    } else if (codec.includes('aac')) {
        return { type: 'aac', description: 'AAC 音频编码' };
    } else if (codec.includes('opus')) {
        return { type: 'opus', description: 'Opus 音频编码' };
    } else if (codec.includes('mp4a')) {
        return { type: 'aac', description: 'AAC 音频编码' };
    } else {
        return { type: 'other', description: `其他编码: ${codec}` };
    }
}

/**
 * 智能选择最佳播放流
 */
export function selectBestStream(streams: any[], currentQuality: number | null = null): any {
    if (!streams?.length) return null;
    
    // 按质量和带宽排序
    const sortedStreams = streams.sort((a, b) => {
        // 如果指定了期望质量，优先选择该质量
        if (currentQuality) {
            if (a.id === currentQuality) return -1;
            if (b.id === currentQuality) return 1;
        }
        // 否则按质量和带宽排序
        return b.id - a.id || b.bandwidth - a.bandwidth;
    });
    
    return sortedStreams[0];
}

/**
 * 生成MPD文件内容
 */
export function generateMPD(response: VideoStreamResponse): string {
    if (!response.data.dash) {
        throw new Error('无效的DASH数据');
    }

    // 获取视频时长（毫秒转为秒）
    const duration = response.data.dash.duration || Math.floor(response.data.timelength / 1000);
    const finalDuration = (duration && !isNaN(duration) && duration > 0) ? duration : 3600;
    const minBufferTime = response.data.dash.min_buffer_time || 1.5;
    
    // MPD文件头部
    let mpd = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" 
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
    xsi:schemaLocation="urn:mpeg:dash:schema:mpd:2011 DASH-MPD.xsd" 
    profiles="urn:mpeg:dash:profile:isoff-on-demand:2011"
    type="static" 
    minBufferTime="PT${minBufferTime}S" 
    mediaPresentationDuration="PT${finalDuration}S">
    <Period id="1" start="PT0S">`;

    // 添加视频流
    if (response.data.dash.video?.length > 0) {
        const validVideos = response.data.dash.video.filter(v => 
            v && v.baseUrl && v.id && v.codecs && v.bandwidth && 
            v.width && v.height && v.frameRate
        );

        if (validVideos.length > 0) {
            const maxWidth = Math.max(...validVideos.map(v => v.width));
            const maxHeight = Math.max(...validVideos.map(v => v.height));
            
            mpd += `
        <AdaptationSet 
            mimeType="video/mp4" 
            segmentAlignment="true" 
            startWithSAP="1"
            maxWidth="${maxWidth}"
            maxHeight="${maxHeight}">`;

            const sortedVideos = [...validVideos].sort((a, b) => {
                const heightDiff = b.height - a.height;
                return heightDiff !== 0 ? heightDiff : b.bandwidth - a.bandwidth;
            });

            for (const video of sortedVideos) {
                mpd += `
            <Representation 
                id="video-${video.id}" 
                codecs="${video.codecs}" 
                bandwidth="${video.bandwidth}" 
                width="${video.width}" 
                height="${video.height}" 
                frameRate="${video.frameRate}"
                scanType="progressive">
                <BaseURL>${video.baseUrl}</BaseURL>
                <SegmentBase indexRange="${video.segment_base?.index_range || '0-0'}">
                    <Initialization range="${video.segment_base?.initialization || '0-0'}"/>
                </SegmentBase>
            </Representation>`;
            }

            mpd += `
        </AdaptationSet>`;
        }
    }

    // 添加音频流
    if (response.data.dash.audio?.length > 0) {
        const validAudios = response.data.dash.audio.filter(a => 
            a && a.baseUrl && a.codecs && a.bandwidth
        );

        if (validAudios.length > 0) {
            const sortedAudios = [...validAudios].sort((a, b) => b.bandwidth - a.bandwidth);
            
            mpd += `
        <AdaptationSet 
            mimeType="audio/mp4" 
            segmentAlignment="true" 
            startWithSAP="1"
            lang="und">`;

            for (const audio of sortedAudios) {
                const audioId = audio.id || Math.floor(Math.random() * 1000);
                
                mpd += `
            <Representation 
                id="audio-${audioId}" 
                codecs="${audio.codecs}" 
                bandwidth="${audio.bandwidth}">
                <BaseURL>${audio.baseUrl}</BaseURL>
                <SegmentBase indexRange="${audio.segment_base?.index_range || '0-0'}">
                    <Initialization range="${audio.segment_base?.initialization || '0-0'}"/>
                </SegmentBase>
            </Representation>`;
            }

            mpd += `
        </AdaptationSet>`;
        }
    }

    mpd += `
    </Period>
</MPD>`;

    return mpd;
} 