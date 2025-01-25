<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Player from './Player.svelte';
    import PlayList from './PlayList.svelte';
    import Setting from './Setting.svelte';
    import ControlBar from './ControlBar.svelte';
    import type { ConfigManager } from '../core/config';
    import type { MediaItem } from '../core/types';
    import md5 from 'md5';
    import { BilibiliParser } from '../core/bilibili';
    import { LinkHandler } from '../core/LinkHandler.ts.1';
    
    // 组件属性
    export let app: any;
    export let configManager: ConfigManager;
    export let linkHandler: LinkHandler;
    
    // 状态管理
    let showControls = true;      // 控制栏显示状态
    let controlTimer: number;      // 自动隐藏定时器
    let showPlaylist = false;      // 播放列表显示状态
    let showSettings = false;      // 设置面板显示状态
    let currentItem: MediaItem | null = null;  // 当前播放项
    let player: Player;           // 播放器组件引用
    let playerConfig: any;        // 播放器配置
    let loopStartTime: number | null = null;  // 循环片段开始时间
    let playlist: PlayList;       // 播放列表组件引用
    
    const NewLute: () => Lute = (globalThis as any).Lute.New;

    /**
     * 获取当前块ID
     */
    function getCurrentBlockId(): string {
        // 获取当前选中的块
        const selection = window.getSelection();
        if (!selection || !selection.focusNode) {
            throw new Error('未找到光标位置');
        }

        // 从光标位置向上查找块元素
        let element = selection.focusNode as HTMLElement;
        while (element && !element.dataset?.nodeId) {
            element = element.parentElement as HTMLElement;
        }

        if (!element || !element.dataset.nodeId) {
            throw new Error('未找到目标块');
        }

        return element.dataset.nodeId;
    }

    /**
     * 插入块到当前位置的下方
     */
    async function insertBlock(content: string) {
        try {
            // 获取当前块ID
            const currentBlockId = getCurrentBlockId();

            // 构造插入块的请求
            const response = await fetch('/api/block/insertBlock', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data: content,
                    dataType: "markdown",
                    previousID: currentBlockId  // 使用 previousID 参数指定在当前块后面插入
                })
            });

            if (!response.ok) {
                throw new Error('插入块失败');
            }

            showMessage('链接已插入');
            
        } catch (error) {
            console.error('[MediaPlayerTab] 插入块失败:', error);
            // 如果插入失败，退回到复制到剪贴板
            await navigator.clipboard.writeText(content);
            showMessage('插入失败，已复制到剪贴板');
        }
    }

    // 初始化时加载配置
    onMount(async () => {
        const config = await configManager.load();
        playerConfig = config.settings;
        // 确保配置中有循环次数设置
        if (!playerConfig.loopCount) {
            playerConfig.loopCount = 3;  // 默认值
        }
    });

    // 组件销毁时清理
    onDestroy(() => {
        // 清除 LinkHandler 中的播放列表引用
        if (linkHandler) {
            linkHandler.setPlaylist(null);
        }
    });
    
    // 处理设置变更
    function handleSettingsChanged(event: CustomEvent) {
        const { settings } = event.detail;
        playerConfig = settings;
        if (player) {
            player.updateConfig(settings);
        }
    }
    
    // 鼠标移动时显示控制栏,3秒后自动隐藏
    function handleMouseMove() {
        showControls = true;
        clearTimeout(controlTimer);
        controlTimer = window.setTimeout(() => {
            showControls = false;
        }, 3000);
    }
    
    // 鼠标离开时立即隐藏控制栏
    function handleMouseLeave() {
        clearTimeout(controlTimer);
        showControls = false;
    }
    
    // 格式化时间戳
    function formatTime(seconds: number, isAnchorText: boolean = false): string {
        if (isNaN(seconds)) return '0:00';
        
        // 锚文本取整，URL参数保留一位小数
        const time = isAnchorText ? Math.round(seconds) : Number(seconds.toFixed(1));
        
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const secs = isAnchorText ? 
            Math.floor(time % 60) : 
            Number((time % 60).toFixed(1));
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 生成时间戳链接
     */
    function generateTimestampLink(mediaItem: MediaItem, options: {
        isLoop: boolean;
        startTime?: number;
        endTime?: number;
        count?: number;
    }): string | null {
        if (!player) return null;

        try {
            const currentTime = options.startTime ?? player.getCurrentTime();
            const endTime = options.endTime ?? (options.isLoop ? currentTime + 3 : undefined);
            
            // 使用原始链接或当前链接
            const baseUrl = mediaItem.originalUrl || mediaItem.url;
            if (!baseUrl) {
                throw new Error('无法获取媒体链接');
            }

            const urlObj = new URL(baseUrl);
            
            // 清除已有的时间参数
            urlObj.searchParams.delete('t');
            
            // 添加新的时间参数
            if (options.isLoop && endTime) {
                // 循环片段格式：[1:23-1:26](url?t=83.1-86.4)
                urlObj.searchParams.set('t', `${currentTime.toFixed(1)}-${endTime.toFixed(1)}`);
                
                const formattedStart = formatTime(currentTime, true);
                const formattedEnd = formatTime(endTime, true);
                return `- [${formattedStart}-${formattedEnd}](${urlObj.toString()})`;
            } else {
                // 时间戳格式：[1:23](url?t=83.1)
                urlObj.searchParams.set('t', currentTime.toFixed(1));
                return `- [${formatTime(currentTime, true)}](${urlObj.toString()})`;
            }
        } catch (error) {
            console.error('[MediaPlayerTab] 生成链接失败:', error);
            showMessage('生成链接失败');
            return null;
        }
    }

    /**
     * 获取截图数据
     */
    async function getScreenshot(): Promise<Blob | null> {
        if (!player) return null;
        
        try {
            // 获取截图的 base64 数据
            const dataUrl = await player.getScreenshotDataURL();
            if (!dataUrl) return null;
            
            // 转换为 Blob
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            return blob;
        } catch (error) {
            console.error('[MediaPlayerTab] 截图失败:', error);
            return null;
        }
    }

    // 处理控制栏事件
    async function handleControlBarEvents(event: CustomEvent) {
        switch (event.type) {
            case 'screenshot':
                if (player && currentItem) {
                    try {
                        const imageBlob = await getScreenshot();
                        if (imageBlob) {
                            // 构造文件名
                            const timestamp = new Date().getTime();
                            const filename = `${currentItem.title || 'screenshot'}_${timestamp}.png`;
                            
                            // 构造 FormData
                            const formData = new FormData();
                            formData.append('file[]', imageBlob, filename);
                            
                            // 上传图片
                            const response = await fetch('/api/asset/upload', {
                                method: 'POST',
                                body: formData
                            });
                            
                            if (!response.ok) {
                                throw new Error('上传图片失败');
                            }
                            
                            const result = await response.json();
                            if (result.code !== 0) {
                                throw new Error(result.msg || '上传图片失败');
                            }
                            
                            // 获取上传后的图片URL
                            const imageUrl = result.data.succMap[filename];
                            
                            // 构造并插入 Markdown
                            const imageMarkdown = `![${filename}](${imageUrl})`;
                            await insertBlock(imageMarkdown);
                            showMessage('截图已插入');
                        } else {
                            showMessage('截图失败，请确保视频正在播放');
                        }
                    } catch (error) {
                        console.error('[MediaPlayerTab] 截图失败:', error);
                        showMessage('截图失败，请重试');
                    }
                } else {
                    showMessage('请先播放视频');
                }
                break;
            case 'timestamp':
                if (player && currentItem) {
                    const timestampLink = generateTimestampLink(currentItem, {
                        isLoop: false,
                        count: 0
                    });
                    if (timestampLink) {
                        await insertBlock(timestampLink);
                    }
                } else {
                    showMessage('请先播放媒体');
                }
                break;
            case 'loopSegment':
                if (!player || !currentItem) return;
                
                const currentTime = player.getCurrentTime();
                if (loopStartTime === null) {
                    // 记录开始时间
                    loopStartTime = currentTime;
                    showMessage('已记录循环片段开始时间');
                } else {
                    // 生成循环片段链接
                    const timestampLink = generateTimestampLink(currentItem, {
                        isLoop: true,
                        startTime: loopStartTime,
                        endTime: currentTime,
                        count: 3
                    });
                    
                    if (timestampLink) {
                        await insertBlock(timestampLink);
                    }
                    
                    // 重置开始时间
                    loopStartTime = null;
                }
                break;
            case 'playlist':
                showPlaylist = !showPlaylist;
                if (showPlaylist) showSettings = false;
                break;
            case 'settings':
                showSettings = !showSettings;
                if (showSettings) showPlaylist = false;
                break;
        }
    }

    // 处理播放列表选择事件
    function handleSelect(event: CustomEvent<MediaItem>) {
        currentItem = event.detail;
    }
    
    // 处理播放列表播放事件
    async function handlePlay(event: CustomEvent) {
        // 更新当前项，保存完整的媒体信息
        currentItem = {
            ...currentItem,
            title: event.detail.title,
            url: event.detail.url,
            originalUrl: event.detail.originalUrl || event.detail.url // 保存原始链接
        };
        
        if (player) {
            player.play(event.detail.url, event.detail);
        }
    }

    // 处理播放流错误
    async function handleStreamError(event: CustomEvent) {
        const { type, url, options } = event.detail;
        
        if (type === 'bilibili' && currentItem?.bvid && currentItem?.cid) {
            try {
                console.log('[播放器] 重新获取B站播放流');
                const config = await configManager.getConfig();
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    currentItem.bvid,
                    currentItem.cid,
                    0,  // 不限制清晰度，让系统自动选择
                    config,
                    currentItem.page  // 添加分P页码参数
                );
                
                // 使用新的播放流重新播放
                if (player) {
                    player.play(streamInfo.video.url, {
                        type: 'bilibili',
                        audioUrl: streamInfo.audio.url,
                        headers: streamInfo.headers,
                        title: currentItem.title
                    });
                }
            } catch (err) {
                console.error('[播放器] 重新获取播放流失败:', err);
                showMessage('视频播放失败，请稍后重试');
            }
        }
    }

    // 在组件挂载时添加事件监听
    onMount(() => {
        const playerContainer = document.querySelector('.artplayer-app');
        if (playerContainer) {
            playerContainer.addEventListener('streamError', handleStreamError);
        }
        
        return () => {
            if (playerContainer) {
                playerContainer.removeEventListener('streamError', handleStreamError);
            }
        };
    });

    // 监听播放器组件的挂载
    $: if (player) {
        // 确保播放器实例已经完全初始化
        setTimeout(() => {
            console.log("[MediaPlayerTab] 播放器就绪");
        }, 100);  // 给予一些初始化时间
    }

    // 监听播放列表组件的挂载
    $: if (playlist && linkHandler) {
        console.log("[MediaPlayerTab] 播放列表就绪，更新 LinkHandler");
        linkHandler.setPlaylist(playlist);
    }
</script>

<!-- 主容器: 处理鼠标移动事件以控制控制栏的显示/隐藏 -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div 
    class="media-player-tab"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
>
    <!-- 内容区域: 包含播放器和侧边栏 -->
    <div class="content-area" class:with-sidebar={showPlaylist || showSettings}>
        <!-- 播放器区域: 用于显示视频内容 -->
        <div class="player-area">
            <Player 
                bind:this={player}
                {app}
                config={playerConfig}
            />
            
            <!-- 控制栏: 顶部悬浮的控制按钮区域 -->
            <div class="control-bar" class:hidden={!showControls}>
                <ControlBar 
                    title={currentItem?.title}
                    {loopStartTime}
                    on:screenshot={handleControlBarEvents}
                    on:timestamp={handleControlBarEvents}
                    on:loopSegment={handleControlBarEvents}
                    on:playlist={handleControlBarEvents}
                    on:settings={handleControlBarEvents}
                />
            </div>
        </div>
        
        <!-- 侧边栏: 用于显示播放列表或设置面板 -->
        <div class="sidebar" class:show={showPlaylist || showSettings}>
            <PlayList 
                bind:this={playlist}
                {configManager}
                {currentItem}
                className="playlist-container"
                hidden={!showPlaylist}
                on:select={handleSelect}
                on:play={handlePlay}
            />
            {#if showSettings}
                <Setting 
                    group="mediaPlayer"
                    {configManager}
                    on:changed={handleSettingsChanged}
                />
            {/if}
        </div>
    </div>
</div> 