<script lang="ts">
    import { onMount } from 'svelte';
    import { showMessage } from 'siyuan';
    import Player from './Player.svelte';
    import PlayList from './PlayList.svelte';
    import Setting from './Setting.svelte';
    import ControlBar from './ControlBar.svelte';
    import type { ConfigManager } from '../core/config';
    import type { MediaItem } from '../core/types';
    import md5 from 'md5';
    import { BilibiliParser } from '../core/bilibili';
    
    // 组件属性
    export let app: any;
    export let configManager: ConfigManager;
    export let onPlayerReady: (player: any) => void;
    
    // 状态管理
    let showControls = true;      // 控制栏显示状态
    let controlTimer: number;      // 自动隐藏定时器
    let showPlaylist = false;      // 播放列表显示状态
    let showSettings = false;      // 设置面板显示状态
    let currentItem: MediaItem | null = null;  // 当前播放项
    let player: Player;           // 播放器组件引用
    let playerConfig: any;        // 播放器配置
    
    // 初始化时加载配置并生成 WBI 签名
    onMount(async () => {
        const config = await configManager.load();
        playerConfig = config.settings;
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
    
    // 处理控制栏事件
    async function handleControlBarEvents(event: CustomEvent) {
        switch(event.type) {
            case 'screenshot':
                if (player) {
                    const success = await player.screenshot();
                    if (success) {
                        showMessage('截图已复制到剪贴板');
                    } else {
                        showMessage('截图失败，请确保视频正在播放');
                    }
                }
                break;
            case 'timestamp':
                if (player) {
                    const timestampLink = player.generateTimestampLink(currentItem);
                    if (timestampLink) {
                        try {
                            await navigator.clipboard.writeText(timestampLink);
                            showMessage('时间戳已复制到剪贴板');
                        } catch (err) {
                            console.error('复制时间戳失败:', err);
                            showMessage('复制时间戳失败');
                        }
                    } else {
                        showMessage('无法生成时间戳，请确保视频正在播放');
                    }
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
    async function handlePlay(event: CustomEvent<MediaItem>) {
        currentItem = event.detail;
        
        if (player) {
            // 如果是B站视频
            if (currentItem.type === 'bilibili') {
                player.play(currentItem.url, currentItem.playOptions || {
                    type: 'bilibili',
                    bvid: currentItem.bvid,
                    originalUrl: currentItem.originalUrl || currentItem.url,
                    audioUrl: currentItem.audioUrl,
                    headers: currentItem.headers,
                    title: currentItem.title,
                    autoplay: playerConfig?.autoplay,
                    startTime: 0
                });
            } else {
                // 普通媒体直接播放
                player.play(currentItem.url, {
                    originalUrl: currentItem.originalUrl || currentItem.url,
                    autoplay: playerConfig?.autoplay,
                    startTime: 0
                });
            }
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
            onPlayerReady(player);
        }, 0);
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
                    {currentItem}
                    on:screenshot={handleControlBarEvents}
                    on:timestamp={handleControlBarEvents}
                    on:playlist={handleControlBarEvents}
                    on:settings={handleControlBarEvents}
                />
            </div>
        </div>
        
        <!-- 侧边栏: 用于显示播放列表或设置面板 -->
        <div class="sidebar" class:show={showPlaylist || showSettings}>
            {#if showPlaylist}
                <PlayList 
                    {configManager}
                    {currentItem}
                    on:select={handleSelect}
                    on:play={handlePlay}
                />
            {/if}
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