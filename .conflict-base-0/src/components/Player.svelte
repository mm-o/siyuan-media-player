<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Artplayer from 'artplayer';
    import type { MediaItem } from '../types/media';
    
    // 组件属性
    export let app: any;
    export let config: any;
    
    // Artplayer 实例
    let art: Artplayer;
    // 播放器容器 DOM 元素引用
    let playerContainer: HTMLElement;
    
    // 添加原始链接存储
    let originalUrl: string | null = null;
    let originalMediaType: string | null = null;
    let originalBvid: string | null = null;
    
    /**
     * 创建B站视频音频插件
     */
    function createBiliAudioPlugin({ url, title, headers }: { url: string, title: string, headers?: any }) {
        let audio: HTMLAudioElement | null = null;
        let isDestroyed = false;  // 添加销毁标记
        
        return (art: any) => {
            // 创建音频元素
            audio = new Audio();
            
            // 处理音频URL
            const audioUrl = new URL(url);
            if (headers?.Referer) {
                audioUrl.searchParams.set('referer', headers.Referer);
            }
            if (headers?.Cookie) {
                audioUrl.searchParams.set('cookie', headers.Cookie);
            }
            audio.src = audioUrl.toString();
            
            // 音量变化
            art.on('video:volumechange', () => {
                if (audio && !isDestroyed) {  // 检查是否已销毁
                    audio.currentTime = art.currentTime;
                    audio.volume = art.volume;
                    audio.muted = art.muted;
                }
            });

            // 开始播放
            art.on('play', () => {
                if (audio && !isDestroyed) {  // 检查是否已销毁
                    audio.currentTime = art.currentTime;
                    audio.play().catch(err => {
                        console.error('[播放器] B站音频播放失败:', err);
                    });
                }
            });

            // 暂停播放
            art.on('pause', () => {
                if (audio && !isDestroyed) {  // 检查是否已销毁
                    audio.currentTime = art.currentTime;
                    audio.pause();
                }
            });

            // 播放速度变化
            art.on('video:ratechange', () => {
                if (audio && !isDestroyed) {  // 检查是否已销毁
                    audio.currentTime = art.currentTime;
                    audio.playbackRate = art.playbackRate;
                }
            });

            // 进度跳转
            art.on('video:seeked', () => {
                if (audio && !isDestroyed) {  // 检查是否已销毁
                    audio.currentTime = art.currentTime;
                }
            });

            // 播放结束
            art.on('video:ended', () => {
                audio.pause();
                audio.currentTime = 0;
            });

            // 添加销毁方法
            const destroy = () => {
                if (audio && !isDestroyed) {
                    isDestroyed = true;  // 设置销毁标记
                    audio.pause();
                    audio.src = '';
                    audio.remove();
                    audio = null;
                }
            };

            // 播放器销毁时清理音频
            art.on('destroy', destroy);

            // 返回插件接口
            return {
                name: 'bilibili',
                destroy
            };
        };
    }

    /**
     * 播放指定URL的媒体
     */
    export async function play(url: string, options?: any) {
        if (!art) {
            throw new Error("播放器未初始化");
        }

        // 保存原始链接信息
        originalUrl = options?.originalUrl || url;
        originalMediaType = options?.type || null;
        originalBvid = options?.bvid || null;

        return new Promise<void>((resolve, reject) => {
            try {
                // 如果当前正在播放B站视频，需要先销毁音频插件
                if (art.plugins) {
                    // 安全地销毁B站音频插件
                    const biliPlugin = art.plugins.bilibili;
                    if (biliPlugin && typeof biliPlugin.destroy === 'function') {
                        biliPlugin.destroy();
                    }
                }

                if (options?.type === 'bilibili' && options.audioUrl) {
                    console.log('[播放器] 开始播放B站视频:', {
                        标题: options.title,
                        播放信息: {
                            视频流: {
                                地址: url,
                                请求头: options.headers
                            },
                            音频流: {
                                地址: options.audioUrl,
                                请求头: options.headers
                            }
                        }
                    });

                    // 重新初始化播放器以支持音频插件
                    art.destroy(true);
                    art = new Artplayer({
                        ...art.option,
                        container: playerContainer,
                        url: url,
                        autoplay: config?.autoplay ?? false,
                        customType: {
                            bilibili: function(video: HTMLVideoElement, url: string) {
                                // 处理视频 URL
                                const videoUrl = new URL(url);
                                if (options.headers?.Referer) {
                                    videoUrl.searchParams.set('referer', options.headers.Referer);
                                }
                                if (options.headers?.Cookie) {
                                    videoUrl.searchParams.set('cookie', options.headers.Cookie);
                                }
                                video.src = videoUrl.toString();
                                
                                // 安全地设置起始时间
                                if (options.startTime !== null && options.startTime !== undefined) {
                                    const time = parseFloat(options.startTime);
                                    if (Number.isFinite(time) && time >= 0) {
                                        // 等待视频加载完成后设置时间
                                        video.addEventListener('loadedmetadata', () => {
                                            try {
                                                // 确保时间不超过视频总长度
                                                const targetTime = Math.min(time, video.duration);
                                                video.currentTime = targetTime;
                                            } catch (error) {
                                                console.error('[播放器] 设置视频时间失败:', error);
                                            }
                                        }, { once: true });
                                    } else {
                                        console.warn('[播放器] 无效的起始时间:', options.startTime);
                                    }
                                }
                            }
                        },
                        type: 'bilibili',
                        plugins: [
                            createBiliAudioPlugin({
                                url: options.audioUrl,
                                title: options.title,
                                headers: options.headers
                            })
                        ]
                    });

                    // 监听错误事件
                    art.on('error', async () => {
                        console.error('[播放器] B站视频播放失败，尝试重新获取播放流');
                        try {
                            // 通知父组件需要重新获取播放流
                            const event = new CustomEvent('streamError', {
                                detail: {
                                    type: 'bilibili',
                                    url: url,
                                    options: options
                                }
                            });
                            playerContainer.dispatchEvent(event);
                        } catch (err) {
                            console.error('[播放器] 重试播放失败:', err);
                        }
                    });

                    // 监听播放开始事件
                    art.once('ready', () => {
                        if (options.startTime !== null) {
                            art.currentTime = options.startTime;
                        }
                        // 如果启用了自动播放，则开始播放
                        if (config?.autoplay) {
                            art.play();
                        }
                        resolve();
                    });
                    art.once('error', (error: any) => reject(error));
                } else {
                    // 普通媒体播放时，需要重新初始化播放器以清除所有插件
                    art.destroy(true);
                    art = new Artplayer({
                        ...art.option,
                        container: playerContainer,
                        url: url,
                        autoplay: config?.autoplay ?? false,
                        volume: art.volume,
                        currentTime: 0,
                        customType: {},  // 清空自定义类型
                        plugins: []      // 清空插件
                    });

                    art.once('ready', () => {
                        // 设置起始时间
                        if (options?.startTime !== undefined) {
                            art.currentTime = options.startTime;
                        }
                        // 如果启用了自动播放，则开始播放
                        if (options?.autoplay) {
                            art.play();
                        }
                        resolve();
                    });
                    
                    art.once('error', (error: any) => reject(error));
                }
            } catch (error) {
                reject(error);
            }
        });
    }
    
    /**
     * 更新播放器配置
     * @param newConfig 新的配置项
     */
    export function updateConfig(newConfig: any) {
        if (art) {
            // 更新音量
            art.volume = newConfig.volume / 100;
            // 更新播放速度
            art.playbackRate = newConfig.speed / 100;
            // 更新循环播放状态
            art.loop = newConfig.loop;
            
            // 如果是自动播放且有视频源，则开始播放
            if (newConfig.autoplay && art.url) {
                art.play();
            }
        }
    }
    
    /**
     * 截图功能
     * @returns Promise<boolean> 截图是否成功
     */
    export async function screenshot(): Promise<boolean> {
        if (!art) return false;
        
        try {
            // 获取截图的 base64 数据
            const dataUrl = await art.getDataURL();
            
            // 转换为 Blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            
            // 复制到剪贴板
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);
            
            return true;
        } catch (error) {
            console.error('[播放器] 截图失败:', error);
            return false;
        }
    }
    
    /**
     * 格式化时间戳
     * @param seconds 秒数
     * @returns 格式化后的时间字符串 (HH:MM:SS 或 MM:SS)
     */
    function formatTimestamp(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * 生成带时间戳的链接
     * @returns {string} 带时间戳的链接文本
     */
    export function generateTimestampLink(currentItem?: MediaItem | null): string | null {
        if (!art) return null;
        
        const timestamp = formatTimestamp(art.currentTime);
        const currentTime = art.currentTime.toFixed(1);
        
        // 如果是B站视频，使用BV号构建链接
        if (originalMediaType === 'bilibili' && originalBvid) {
            const biliUrl = `https://www.bilibili.com/video/${originalBvid}/`;
            return `[${timestamp}](${biliUrl}?t=${currentTime})`;
        }
        
        // 其他类型视频使用原始URL
        if (originalUrl) {
            if (originalUrl.startsWith('http')) {
                return `[${timestamp}](${originalUrl}#t=${currentTime})`;
            } else {
                // 本地文件
                return `[${timestamp}](${originalUrl}#t=${currentTime})`;
            }
        }
        
        return null;
    }
    
    /**
     * 跳转到指定时间
     */
    export function seek(time: number) {
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
            art.currentTime = targetTime;
        } catch (error) {
            console.error('[播放器] 跳转失败:', error);
        }
    }
    
    /**
     * 添加事件监听
     */
    export function on(event: string, callback: () => void) {
        if (art) {
            art.on(event, callback);
        }
    }

    /**
     * 移除事件监听
     */
    export function off(event: string, callback: () => void) {
        if (art) {
            art.off(event, callback);
        }
    }

    /**
     * 添加一次性事件监听
     */
    export function once(event: string, callback: () => void) {
        if (art) {
            art.once(event, callback);
        }
    }
    
    // 组件挂载时初始化播放器
    onMount(() => {
        if (playerContainer) {
            // 开启调试模式
            //Artplayer.DEBUG = true;
            
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
                container: playerContainer,  // 播放器容器元素
                url: '',  // 初始视频源为空
                volume: initialConfig.volume / 100,  // 音量,需要除以100转换为0-1的范围
                isLive: false,  // 是否为直播
                muted: false,  // 是否静音
                autoplay: initialConfig.autoplay,  // 是否自动播放
                pip: true,  // 是否启用画中画
                autoSize: true,  // 自动调整大小
                autoMini: true,  // 自动开启迷你模式
                setting: true,  // 显示设置按钮
                loop: initialConfig.loop,  // 是否循环播放
                flip: true,  // 启用画面翻转
                playbackRate: true,  // 启用播放速度调节
                aspectRatio: true,  // 启用画面比例调节
                fullscreen: true,  // 启用全屏
                fullscreenWeb: true,  // 启用网页全屏
                subtitleOffset: true,  // 启用字幕偏移调节
                miniProgressBar: true,  // 显示迷你进度条
                mutex: true,  // 互斥播放
                backdrop: true,  // 启用背景遮罩
                playsInline: true,  // 启用行内播放
                autoPlayback: true,  // 启用自动续播
                theme: 'var(--b3-theme-primary)',  // 主题色跟随系统
                lang: 'zh-cn',  // 使用中文
                crossOrigin: 'anonymous'  // 跨域设置
            });
            
            // 添加事件监听器以打印所有事件
            art.on('all', (eventName: string, ...args: any[]) => {
                console.log(`[Artplayer Event] ${eventName}:`, ...args);
            });
            
            // 初始化后设置播放速度和其他配置
            if (initialConfig) {
                updateConfig(initialConfig);
            }
        }
    });
    
    // 组件销毁时清理播放器实例
    onDestroy(() => {
        if (art) {
            // 安全地销毁B站音频插件
            if (art.plugins) {
                const biliPlugin = art.plugins.bilibili;
                if (biliPlugin && typeof biliPlugin.destroy === 'function') {
                    biliPlugin.destroy();
                }
            }
            art.destroy(true);
        }
    });
</script>

<div class="artplayer-app" bind:this={playerContainer}>
    <!-- Artplayer 将在这里初始化 -->
</div>