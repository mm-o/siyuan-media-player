<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Player from './Player.svelte';
    import PlayList from './PlayList.svelte';
    import Setting from './Setting.svelte';
    import ControlBar from './ControlBar.svelte';
    import type { ConfigManager } from '../core/config';
    import type { MediaItem } from '../core/types';
    import { BilibiliParser } from '../core/bilibili';
    import { LinkHandler } from '../core/LinkHandler';

    // 类型定义
    interface PlayOptions {
        url: string;
        type?: 'bilibili-dash' | 'bilibili';
        headers?: Record<string, string>;
        title?: string;
        startTime?: number;
        endTime?: number;
        isLoop?: boolean;
        loopCount?: number;
        originalUrl?: string;
        bvid?: string;
    }

    interface ControlBarEvent {
        type: 'screenshot' | 'timestamp' | 'loopSegment' | 'playlist' | 'settings';
    }
    
    // 组件属性
    export let app: any;
    export let configManager: ConfigManager;
    export let linkHandler: LinkHandler;
    
    // 获取i18n对象
    let i18n = app.i18n;
    
    // 状态管理
    let showControls = true;
    let controlTimer: number;
    let showPlaylist = false;
    let showSettings = false;
    let currentItem: MediaItem | null = null;
    let player: Player;
    let playerConfig: any;
    let loopStartTime: number | null = null;
    let playlist: PlayList;
    let settingPanel: Setting;

    // =============== 工具函数 ===============
    /**
     * 获取当前块ID
     * @throws {Error} 当无法找到光标位置或目标块时
     */
    function getCurrentBlockId(): string {
        const selection = window.getSelection();
        if (!selection?.focusNode) {
            throw new Error(i18n.mediaPlayerTab.block.cursorNotFound);
        }

        let element = selection.focusNode as HTMLElement;
        while (element && !element.dataset?.nodeId) {
            element = element.parentElement as HTMLElement;
        }

        if (!element?.dataset.nodeId) {
            throw new Error(i18n.mediaPlayerTab.block.targetBlockNotFound);
        }

        return element.dataset.nodeId;
    }

    /**
     * 格式化时间戳
     * @param seconds 秒数
     * @param isAnchorText 是否作为锚点文本
     */
    function formatTime(seconds: number, isAnchorText: boolean = false): string {
        if (isNaN(seconds)) return '0:00';
        
        const time = isAnchorText ? Math.round(seconds) : Number(seconds.toFixed(1));
        const hours = Math.floor(time / 3600);
        const minutes = Math.floor((time % 3600) / 60);
        const secs = isAnchorText ? 
            Math.floor(time % 60) : 
            Number((time % 60).toFixed(1));
        
        return hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            : `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    // =============== 块操作相关 ===============
    /**
     * 插入块到当前位置的下方
     * @param content 要插入的内容
     */
    async function insertBlock(content: string): Promise<void> {
        try {
            const config = await configManager.getConfig();
            const insertAtCursor = config.settings.insertAtCursor ?? true;

            if (insertAtCursor) {
                const currentBlockId = getCurrentBlockId();
                const response = await fetch('/api/block/updateBlock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        data: content,
                        dataType: "markdown",
                        id: currentBlockId
                    })
                });

                if (!response.ok) throw new Error(i18n.mediaPlayerTab.block.updateError);
                showMessage(i18n.mediaPlayerTab.block.linkInserted);
            } else {
                await navigator.clipboard.writeText(content);
                showMessage(i18n.mediaPlayerTab.block.copiedToClipboard);
            }
        } catch (error) {
            await navigator.clipboard.writeText(content);
            showMessage(i18n.mediaPlayerTab.block.insertFailed);
        }
    }

    /**
     * 生成时间戳链接
     * @param mediaItem 媒体项
     * @param options 时间戳选项
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
            const baseUrl = mediaItem.originalUrl || mediaItem.url;
            
            if (!baseUrl) throw new Error(i18n.mediaPlayerTab.timestamp.noMediaLink);

            const urlObj = new URL(baseUrl);
            urlObj.searchParams.delete('t');
            
            if (options.isLoop && endTime) {
                urlObj.searchParams.set('t', `${currentTime.toFixed(1)}-${endTime.toFixed(1)}`);
                return `- [${formatTime(currentTime, true)}-${formatTime(endTime, true)}](${urlObj.toString()})`;
            } else {
                urlObj.searchParams.set('t', currentTime.toFixed(1));
                return `- [${formatTime(currentTime, true)}](${urlObj.toString()})`;
            }
        } catch (error) {
            showMessage(i18n.mediaPlayerTab.timestamp.generateFailed);
            return null;
        }
    }

    // =============== 截图相关 ===============
    /**
     * 获取截图数据
     */
    async function getScreenshot(): Promise<Blob | null> {
        if (!player) return null;
        
        try {
            const dataUrl = await player.getScreenshotDataURL();
            if (!dataUrl) return null;
            
            const res = await fetch(dataUrl);
            return await res.blob();
        } catch {
            return null;
        }
    }

    /**
     * 上传截图
     * @param imageBlob 图片数据
     * @param filename 文件名
     */
    async function uploadScreenshot(imageBlob: Blob, filename: string): Promise<string> {
                            const formData = new FormData();
                            formData.append('file[]', imageBlob, filename);
                            
                            const response = await fetch('/api/asset/upload', {
                                method: 'POST',
                                body: formData
                            });
                            
        if (!response.ok) throw new Error(i18n.mediaPlayerTab.screenshot.uploadFailed);
                            
                            const result = await response.json();
        if (result.code !== 0) throw new Error(result.msg || i18n.mediaPlayerTab.screenshot.uploadFailed);
        
        return result.data.succMap[filename];
    }

    // =============== 事件处理 ===============
    /**
     * 处理鼠标移动事件
     */
    const handleMouseMove = () => {
        showControls = true;
        clearTimeout(controlTimer);
        controlTimer = window.setTimeout(() => showControls = false, 3000);
    };

    /**
     * 处理鼠标离开事件
     */
    const handleMouseLeave = () => {
        clearTimeout(controlTimer);
        showControls = false;
    };

    /**
     * 处理设置变更事件
     */
    const handleSettingsChanged = (event: CustomEvent) => {
        const { settings } = event.detail;
        playerConfig = settings;
        player?.updateConfig(settings);
    };

    /**
     * 处理媒体选择事件
     */
    const handleSelect = (event: CustomEvent<MediaItem>) => {
        currentItem = event.detail;
    };

    /**
     * 处理控制栏事件
     */
    async function handleControlBarEvents(event: CustomEvent): Promise<void> {
        const type = event.type.replace(':', '') as ControlBarEvent['type'];
        
        // 只有需要播放器的操作才检查播放器状态
        if (['screenshot', 'timestamp', 'loopSegment'].includes(type)) {
            if (!player || !currentItem) {
                showMessage(i18n.controlBar.screenshot.hint);
                return;
            }
        }

        switch (type) {
            case 'screenshot':
                await handleScreenshot();
                break;
            case 'timestamp':
                await handleTimestamp();
                break;
            case 'loopSegment':
                await handleLoopSegment();
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

    /**
     * 处理截图事件
     */
    async function handleScreenshot(): Promise<void> {
        try {
            const imageBlob = await getScreenshot();
            if (!imageBlob) {
                showMessage(i18n.mediaPlayerTab.screenshot.failHint);
                return;
            }

            const timestamp = new Date().getTime();
            const filename = `${currentItem.title || i18n.mediaPlayerTab.screenshot.defaultName}_${timestamp}.png`;
            const imageUrl = await uploadScreenshot(imageBlob, filename);
            
            await insertBlock(`![${filename}](${imageUrl})`);
            showMessage(i18n.mediaPlayerTab.screenshot.successHint);
        } catch {
            showMessage(i18n.mediaPlayerTab.screenshot.errorHint);
        }
    }

    /**
     * 处理时间戳事件
     */
    async function handleTimestamp(): Promise<void> {
        const timestampLink = generateTimestampLink(currentItem, {
            isLoop: false,
            count: 0
        });
        if (timestampLink) await insertBlock(timestampLink);
    }

    /**
     * 处理循环片段事件
     */
    async function handleLoopSegment(): Promise<void> {
        const currentTime = player.getCurrentTime();
        if (loopStartTime === null) {
            loopStartTime = currentTime;
            showMessage(i18n.controlBar.loopSegment.startHint);
        } else {
            const timestampLink = generateTimestampLink(currentItem, {
                isLoop: true,
                startTime: loopStartTime,
                endTime: currentTime,
                count: playerConfig.loopCount
            });
            
            if (timestampLink) await insertBlock(timestampLink);
            loopStartTime = null;
        }
    }

    /**
     * 处理播放事件
     */
    async function handlePlay(event: CustomEvent<PlayOptions>): Promise<void> {
        const playOptions = event.detail;
        if (!playOptions?.url) {
            showMessage(i18n.mediaPlayerTab.play.invalidOptions);
            return;
        }

        try {
            // 创建或更新 currentItem
            currentItem = {
                id: `item-${Date.now()}`,
                title: playOptions.title || i18n.mediaPlayerTab.play.untitledMedia,
                url: playOptions.url,
                originalUrl: playOptions.originalUrl || playOptions.url,
                type: playOptions.type === 'bilibili-dash' || playOptions.type === 'bilibili' ? 'bilibili' : 'video',
                startTime: playOptions.startTime,
                endTime: playOptions.endTime,
                isLoop: playOptions.isLoop,
                loopCount: playOptions.loopCount,
                bvid: playOptions.bvid
            };

            if (playOptions.type === 'bilibili-dash' || playOptions.type === 'bilibili') {
                await player.play(playOptions.url, {
                    type: playOptions.type,
                    headers: playOptions.headers,
                    title: playOptions.title
                });
            } else {
                await player.play(playOptions.url);
            }

            if (playOptions.startTime !== undefined) {
                player.setPlayTime(playOptions.startTime, playOptions.endTime);
            }

            if (playOptions.isLoop) {
                player.setLoop(true, playOptions.loopCount);
            }
        } catch (error) {
            showMessage(i18n.mediaPlayerTab.play.failMessage + error.message);
        }
    }

    /**
     * 处理流错误事件
     */
    async function handleStreamError(event: CustomEvent): Promise<void> {
        const { type } = event.detail;
        
        if (type === 'bilibili' && currentItem?.bvid && currentItem?.cid) {
            try {
                const config = await configManager.getConfig();
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    currentItem.bvid,
                    currentItem.cid,
                    0,
                    config
                );
                
                if (player) {
                    const url = streamInfo.mpdUrl || streamInfo.video.url;
                    const type = streamInfo.mpdUrl ? 'bilibili-dash' : 'bilibili';
                    
                    player.play(url, {
                        type,
                        headers: streamInfo.headers,
                        title: currentItem.title
                    });
                }
            } catch {
                showMessage(i18n.mediaPlayerTab.stream.playbackError);
            }
        }
    }

    // =============== 生命周期钩子 ===============
    onMount(() => {
        const init = async () => {
            const config = await configManager.load();
            playerConfig = config.settings;
            if (!playerConfig.loopCount) {
                playerConfig.loopCount = 3;
            }

        const playerContainer = document.querySelector('.artplayer-app');
        if (playerContainer) {
            playerContainer.addEventListener('streamError', handleStreamError);
        }
        };

        init();
        
        return () => {
            const playerContainer = document.querySelector('.artplayer-app');
            if (playerContainer) {
                playerContainer.removeEventListener('streamError', handleStreamError);
            }
        };
    });

    onDestroy(() => {
        if (linkHandler) {
            linkHandler.setPlaylist(null);
        }
    });

    // =============== 响应式声明 ===============
    $: if (playlist && linkHandler) {
        linkHandler.setPlaylist(playlist);
    }
</script>

<div 
    class="media-player-tab"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
>
    <div class="content-area" class:with-sidebar={showPlaylist || showSettings}>
        <div class="player-area">
            <Player 
                bind:this={player}
                {app}
                config={playerConfig}
                {i18n}
            />
            
            <div class="control-bar" class:hidden={!showControls}>
                <ControlBar 
                    title={currentItem?.title}
                    {loopStartTime}
                    {i18n}
                    on:screenshot={handleControlBarEvents}
                    on:timestamp={handleControlBarEvents}
                    on:loopSegment={handleControlBarEvents}
                    on:playlist={handleControlBarEvents}
                    on:settings={handleControlBarEvents}
                />
            </div>
        </div>
        
        <div class="sidebar" class:show={showPlaylist || showSettings}>
            <PlayList 
                bind:this={playlist}
                {configManager}
                {currentItem}
                className="playlist-container"
                hidden={!showPlaylist}
                {i18n}
                on:select={handleSelect}
                on:play={handlePlay}
            />
            {#if showSettings}
                <Setting 
                    group="media-player"
                    {configManager}
                    {i18n}
                    on:changed={handleSettingsChanged}
                />
            {/if}
        </div>
    </div>
</div> 