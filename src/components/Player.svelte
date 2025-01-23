<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Artplayer from 'artplayer';
    //import artplayerPluginChapter from 'artplayer-plugin-chapter';
    import type { MediaItem, PlayOptions } from '../types/media';
    
    // 组件属性
    export let app: any;
    export let config: any;
    
    // Artplayer 实例
    let art: any = null;
    let chapterPlugin: any = null;  // 添加章节插件引用
    // 播放器容器 DOM 元素引用
    let playerContainer: HTMLElement;
    // 当前循环片段
    let currentChapter: { start: number; end: number; } | null = null;
    // 循环计数器
    let loopCount = 0;
    let maxLoopCount = 3;  // 默认值，将被配置覆盖
    
    // ===================== 1. 初始化 Artplayer 播放器 =====================
    
    onMount(() => {
        if (!playerContainer) return;
        
        // 使用传入的配置或默认配置
        const defaultConfig = {
            volume: 70,
            speed: 100,
            hotkey: true,
            loop: false,
            autoplay: false
        };
        const initialConfig = config ? { ...defaultConfig, ...config } : defaultConfig;
        
        // 初始化 Artplayer 播放器
        art = new Artplayer({
            container: playerContainer,
            url: '',
            volume: initialConfig.volume / 100,
            isLive: false,
            muted: false,
            autoplay: initialConfig.autoplay,
            pip: true,
            autoSize: true,
            autoMini: true,
            setting: true,
            loop: initialConfig.loop,
            flip: true,
            playbackRate: true,
            aspectRatio: true,
            fullscreen: true,
            fullscreenWeb: true,
            subtitleOffset: true,
            miniProgressBar: true,
            mutex: true,
            backdrop: true,
            playsInline: true,
            autoPlayback: true,
            theme: 'var(--b3-theme-primary)',
            lang: 'zh-cn',
            crossOrigin: 'anonymous',
        });
        
        // 添加时间更新监听器
        art.on('video:timeupdate', () => {
            // 检查是否需要循环
            if (currentChapter && art.currentTime >= currentChapter.end) {
                if (maxLoopCount > 0 && loopCount >= maxLoopCount) {
                    // 达到循环次数限制，清除循环
                    currentChapter = null;
                    loopCount = 0;
                    console.log("[Player] 循环结束: 达到最大循环次数");
                    return;
                }
                
                art.currentTime = currentChapter.start;
                loopCount++;
                console.log("[Player] 循环次数:", loopCount);
            }
        });
        
        // 确保播放器完全初始化
        art.on('ready', () => {
            console.log("[Player] Artplayer 就绪");
            if (initialConfig) {
                updateConfig(initialConfig);
            }
        });
    });
    
    // 组件销毁时清理
    onDestroy(() => {
        if (art) {
            audioPlugin.destroy();
            art.destroy(true);
            art = null;
        }
    });
    
    // ===================== 2. 音视频插件 =====================
    
    const audioPlugin = {
        // B站音频元素
        audio: null as HTMLAudioElement | null,

        // 创建音频元素
        createAudio: (url: string, headers?: any) => {
            audioPlugin.destroy();
            
            const audio = new Audio();
            audio.preload = 'auto';
            
            // 添加请求头参数
            if (headers) {
                const audioUrl = new URL(url);
                if (headers.Referer) {
                    audioUrl.searchParams.set('referer', headers.Referer);
                }
                if (headers.Cookie) {
                    audioUrl.searchParams.set('cookie', headers.Cookie);
                }
                audio.src = audioUrl.toString();
            } else {
                audio.src = url;
            }
            
            audioPlugin.audio = audio;
            return audio;
        },

        // 同步音频状态
        syncState: () => {
            if (!audioPlugin.audio || !art) return;
            
            audioPlugin.audio.currentTime = art.currentTime;
            if (art.playing) {
                audioPlugin.audio.play().catch(console.error);
            } else {
                audioPlugin.audio.pause();
            }
            audioPlugin.audio.playbackRate = art.playbackRate;
            audioPlugin.audio.volume = art.volume;
            audioPlugin.audio.muted = art.muted;
        },

        // 注册事件监听
        registerEvents: () => {
            if (!art) return;
            
            art.on('play', () => audioPlugin.syncState());
            art.on('pause', () => audioPlugin.audio?.pause());
            art.on('seek', () => {
                if (audioPlugin.audio) audioPlugin.audio.currentTime = art.currentTime;
            });
            art.on('video:ratechange', () => {
                if (audioPlugin.audio) audioPlugin.audio.playbackRate = art.playbackRate;
            });
            art.on('video:volumechange', () => {
                if (audioPlugin.audio) {
                    audioPlugin.audio.volume = art.volume;
                    audioPlugin.audio.muted = art.muted;
                }
            });
        },
        
        // 销毁音频
        destroy: () => {
            if (audioPlugin.audio) {
                audioPlugin.audio.pause();
                audioPlugin.audio.remove();
                audioPlugin.audio = null;
            }
        }
    };
    
    // ===================== 3. Seek跳转插件 =====================
    
    const seekPlugin = {
        // 跳转到指定时间
        seekTo: (time: number) => {
            if (!art) return;
            
            try {
                // 验证时间值
                const validTime = parseFloat(String(time));
                if (!Number.isFinite(validTime) || validTime < 0) {
                    console.warn('[播放器] 无效的跳转时间:', time);
                    return;
                }
                
                // 确保不超过视频总长度
                const targetTime = Math.min(validTime, art.duration);
                
                // 设置视频时间
                art.currentTime = targetTime;
                
                // 同步音频时间
                if (audioPlugin.audio) {
                    audioPlugin.audio.currentTime = targetTime;
                }
            } catch (error) {
                console.error('[播放器] 跳转失败:', error);
            }
        },
        
        // 获取当前时间
        getCurrentTime: () => art ? art.currentTime : 0
    };
    
    // ===================== 4. 循环播放插件 =====================
    
    /**
     * 设置循环片段
     */
    function setLoop(start: number, end: number, count: number = 3) {
        if (!art) {
            console.warn("[Player] setLoop: art 未就绪");
            return;
        }
        
        try {
            console.log("[Player] 设置循环片段:", { start, end, count });
            
            // 重置循环计数器
            loopCount = 0;
            maxLoopCount = count;
            
            // 记录当前循环片段
            currentChapter = { start, end };
            
            // 如果当前时间不在片段内，跳转到开始位置
            if (art.currentTime < start || art.currentTime > end) {
                art.currentTime = start;
            }
            
            console.log("[Player] 循环片段已设置:", { currentChapter, maxLoopCount });
            
        } catch (error) {
            console.error('[Player] 设置循环片段失败:', error);
            showMessage('设置循环片段失败');
        }
    }

    /**
     * 清除循环片段
     */
    function clearLoop() {
        if (!art) return;
        currentChapter = null;
        loopCount = 0;
    }
    
    // ===================== 导出方法 =====================
    
    // 播放媒体
    export async function play(url: string, options: PlayOptions = {}) {
        if (!art) return;
        
        try {
            console.log("[Player] 开始播放:", { 
                url, 
                options,
                hasStartTime: options.startTime !== undefined,
                hasEndTime: options.endTime !== undefined,
                isLoop: options.isLoop,
                loopCount: options.loopCount
            });

            // 清除现有循环片段
            clearLoop();
            
            // 处理B站音频
            if (options.audioUrl) {
                await audioPlugin.createAudio(options.audioUrl, options.headers);
                audioPlugin.registerEvents();
            } else {
                audioPlugin.destroy();
            }

            // 设置播放源
            await art.switchUrl(url);
            
            // 等待视频就绪
            await new Promise<void>((resolve) => {
                const canPlayHandler = () => {
                    resolve();
                    art.off('video:canplay', canPlayHandler);
                };
                art.on('video:canplay', canPlayHandler);
            });
            
            // 应用播放选项
            if (options.startTime) {
                console.log("[Player] 设置开始时间:", options.startTime);
                art.currentTime = options.startTime;
            }
            
            // 设置循环片段
            if (options.isLoop && options.startTime !== undefined && options.endTime !== undefined) {
                console.log("[Player] 设置循环片段:", {
                    start: options.startTime,
                    end: options.endTime,
                    count: options.loopCount
                });
                setLoop(options.startTime, options.endTime, options.loopCount);
            }
            
            // 设置自动播放
            if (options.autoplay) {
                art.play();
            }
            
        } catch (error) {
            console.error("[Player] 播放失败:", error);
            showMessage("播放失败，请重试");
            
            if (art?.container) {
                const event = new CustomEvent('streamError', {
                    detail: { url, options }
                });
                art.container.dispatchEvent(event);
            }
        }
    }
    
    // 更新配置
    export function updateConfig(newConfig: any) {
        if (!art) return;
        
            art.volume = newConfig.volume / 100;
            art.playbackRate = newConfig.speed / 100;
            art.loop = newConfig.loop;
            
            if (newConfig.autoplay && art.url) {
                art.play();
        }
    }
    
    // 获取截图
    export async function getScreenshotDataURL(): Promise<string | null> {
        if (!art) return null;
        return art.getDataURL();
    }
    
    // 导出 seek 相关方法
    export function seekTo(time: number) {
        if (art) {
            art.currentTime = time;
        }
    }
    export function getCurrentTime(): number {
        return art?.currentTime || 0;
    }
</script>

<div class="artplayer-app" bind:this={playerContainer}>
    <!-- Artplayer 将在这里初始化 -->
</div>

<style>
/* 添加章节插件相关样式 */
:global(.art-chapter-marker) {
    background-color: var(--b3-theme-primary) !important;
    opacity: 0.8;
}
</style>