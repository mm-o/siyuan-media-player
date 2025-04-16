<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { showMessage } from 'siyuan';
    import Player from './Player.svelte';
    import PlayList from './PlayList.svelte';
    import Setting from './Setting.svelte';
    import ControlBar from './ControlBar.svelte';
    import type { ConfigManager } from '../core/config';
    import type { MediaItem } from '../core/types';
    import { PlayerType } from '../core/types';
    import { BilibiliParser } from '../core/bilibili';
    import { LinkHandler } from '../core/LinkHandler';
    import { formatTime } from '../core/utils';

    // =============== 组件属性 ===============
    export let app: any;
    export let configManager: ConfigManager;
    export let linkHandler: LinkHandler;
    
    // =============== 组件状态 ===============
    let i18n = app.i18n;
    let showControls = true;
    let controlTimer: number;
    let showPlaylist = false;
    let showSettings = false;
    let currentItem: MediaItem | null = null;
    let player: Player;
    let playerConfig: any;
    let loopStartTime: number | null = null;
    let playlist: PlayList;

    // =============== 工具函数 ===============
    const getCurrentBlockId = (): string => {
        const selection = window.getSelection();
        if (!selection?.focusNode) throw new Error(i18n.mediaPlayerTab.block.cursorNotFound);

        let element = selection.focusNode as HTMLElement;
        while (element && !element.dataset?.nodeId) {
            element = element.parentElement as HTMLElement;
        }

        if (!element?.dataset.nodeId) throw new Error(i18n.mediaPlayerTab.block.targetBlockNotFound);
        return element.dataset.nodeId;
    };

    const insertContent = async (content: string): Promise<void> => {
        try {
            const config = await configManager.getConfig();
            if (config.settings.insertAtCursor ?? true) {
                const blockId = getCurrentBlockId();
                const response = await fetch('/api/block/updateBlock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ data: content, dataType: "markdown", id: blockId })
                });
                if (!response.ok) throw new Error();
                showMessage(i18n.mediaPlayerTab.block.linkInserted);
            } else {
                await navigator.clipboard.writeText(content);
                showMessage(i18n.mediaPlayerTab.block.copiedToClipboard);
            }
        } catch {
            await navigator.clipboard.writeText(content);
            showMessage(i18n.mediaPlayerTab.block.insertFailed);
        }
    };

    const createTimestampLink = (isLoop = false, startTime?: number, endTime?: number): string | null => {
        if (!player || !currentItem) return null;

        try {
            const currentTime = startTime ?? player.getCurrentTime();
            const loopEndTime = endTime ?? (isLoop ? currentTime + 3 : undefined);
            const baseUrl = currentItem.originalUrl || currentItem.url;
            if (!baseUrl) throw new Error();

            const urlObj = new URL(baseUrl);
            urlObj.searchParams.delete('t');
            urlObj.searchParams.delete('p');
            
            // 先设置时间戳t参数
            if (isLoop && loopEndTime) {
                urlObj.searchParams.set('t', `${currentTime.toFixed(1)}-${loopEndTime.toFixed(1)}`);
            } else {
                urlObj.searchParams.set('t', currentTime.toFixed(1));
            }
            
            // 后设置分p参数
            if (currentItem.type === 'bilibili' && currentItem.id && currentItem.id.includes('-p')) {
                const partMatch = currentItem.id.match(/-p(\d+)$/);
                if (partMatch && partMatch[1]) {
                    urlObj.searchParams.set('p', partMatch[1]);
                }
            }
            
            if (isLoop && loopEndTime) {
                return `- [${formatTime(currentTime, true)}-${formatTime(loopEndTime, true)}](${urlObj.toString()})`;
            }
            return `- [${formatTime(currentTime, true)}](${urlObj.toString()})`;
        } catch {
            showMessage(i18n.mediaPlayerTab.timestamp.generateFailed);
            return null;
        }
    };

    // =============== 媒体操作 ===============
    const openWithPotPlayer = async (url: string, playerPath: string): Promise<void> => {
        try {
            // 检查是否为Electron环境
            if (window.navigator.userAgent.includes('Electron')) {
                // 使用Electron方式调用外部程序
                const { exec } = require('child_process');
                const os = require('os');
                
                // 去除路径两端可能存在的引号
                playerPath = playerPath.replace(/^["']|["']$/g, '');
                
                if (os.platform() === 'win32') {
                    // Windows平台调用
                    exec(`"${playerPath}" "${url}"`, (error) => {
                        if (error) {
                            console.error("打开外部播放器失败:", error);
                            showMessage(`打开外部播放器失败: ${error.message}`);
                        }
                    });
                } else if (os.platform() === 'darwin') {
                    // macOS平台调用
                    exec(`open -a "${playerPath}" "${url}"`, (error) => {
                        if (error) {
                            console.error("打开外部播放器失败:", error);
                            showMessage(`打开外部播放器失败: ${error.message}`);
                        }
                    });
                }
            } else {
                // 浏览器环境使用API调用
                const response = await fetch('/api/system/execCommand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        command: `start "${playerPath}" "${url}"`
                    })
                });
                
                if (!response.ok) {
                    throw new Error("命令执行失败");
                }
            }
        } catch (error) {
            console.error("打开外部播放器失败:", error);
            showMessage(`打开外部播放器失败: ${error.message}`);
        }
    };

    const openInBrowser = async (url: string): Promise<void> => {
        try {
            // 检查是否为Electron环境
            if (window.navigator.userAgent.includes('Electron')) {
                // 使用Electron方式打开浏览器
                const { shell } = require('electron');
                await shell.openExternal(url);
            } else {
                // 浏览器环境直接打开新窗口
                window.open(url, '_blank');
            }
            showMessage(i18n.mediaPlayerTab.browser.openSuccess);
        } catch (error) {
            console.error("在浏览器中打开失败:", error);
            showMessage(`在浏览器中打开失败: ${error.message}`);
        }
    };

    const takeScreenshot = async (): Promise<void> => {
        if (!player || !currentItem) {
            showMessage(i18n.controlBar.screenshot.hint);
            return;
        }

        try {
            const dataUrl = await player.getScreenshotDataURL();
            if (!dataUrl) {
                showMessage(i18n.mediaPlayerTab.screenshot.failHint);
                return;
            }
            
            const res = await fetch(dataUrl);
            const imageBlob = await res.blob();
            const timestamp = Date.now();
            const filename = `${currentItem.title || i18n.mediaPlayerTab.screenshot.defaultName}_${timestamp}.png`;
            
            const formData = new FormData();
            formData.append('file[]', imageBlob, filename);
            
            const response = await fetch('/api/asset/upload', { method: 'POST', body: formData });
            if (!response.ok) throw new Error();
            
            const result = await response.json();
            if (result.code !== 0) throw new Error();
            
            await insertContent(`![${filename}](${result.data.succMap[filename]})`);
            showMessage(i18n.mediaPlayerTab.screenshot.successHint);
        } catch {
            showMessage(i18n.mediaPlayerTab.screenshot.errorHint);
        }
    };

    const createTimestamp = async (): Promise<void> => {
        if (!player || !currentItem) {
            showMessage(i18n.controlBar.screenshot.hint);
            return;
        }
        const link = createTimestampLink(false);
        if (link) await insertContent(link);
    };

    const createLoopSegment = async (): Promise<void> => {
        if (!player || !currentItem) {
            showMessage(i18n.controlBar.screenshot.hint);
            return;
        }
        
        const currentTime = player.getCurrentTime();
        if (loopStartTime === null) {
            loopStartTime = currentTime;
            showMessage(i18n.controlBar.loopSegment.startHint);
        } else {
            const link = createTimestampLink(true, loopStartTime, currentTime);
            if (link) await insertContent(link);
            loopStartTime = null;
        }
    };

    // =============== 事件处理 ===============
    const handleMouseMove = () => {
        showControls = true;
        clearTimeout(controlTimer);
        controlTimer = window.setTimeout(() => showControls = false, 3000);
    };

    const handleMouseLeave = () => {
        clearTimeout(controlTimer);
        showControls = false;
    };

    const handleSettingsChanged = (event: CustomEvent) => {
        playerConfig = event.detail.settings;
        player?.updateConfig(playerConfig);
    };

    const handleSelect = (event: CustomEvent<MediaItem>) => {
        currentItem = event.detail;
    };

    const handleControlEvent = async (event: CustomEvent): Promise<void> => {
        const action = event.type.replace(':', '');
        switch (action) {
            case 'screenshot': await takeScreenshot(); break;
            case 'timestamp': await createTimestamp(); break;
            case 'loopSegment': await createLoopSegment(); break;
            case 'playlist': 
                showPlaylist = !showPlaylist;
                if (showPlaylist) showSettings = false;
                break;
            case 'settings': 
                showSettings = !showSettings;
                if (showSettings) showPlaylist = false;
                break;
        }
    };

    const handleStreamError = (event: CustomEvent): void => {
        if (event.detail.type === 'bilibili') handleBilibiliError();
    };

    const playMedia = async (event: CustomEvent): Promise<void> => {
        const options = event.detail;
        if (!options?.url) {
            showMessage(i18n.mediaPlayerTab.play.invalidOptions);
            return;
        }

        try {
            currentItem = {
                id: options.id || `item-${Date.now()}`,
                title: options.title || i18n.mediaPlayerTab.play.untitledMedia,
                url: options.url,
                originalUrl: options.originalUrl || options.url,
                type: ['bilibili-dash', 'bilibili'].includes(options.type) ? 'bilibili' : 'video',
                startTime: options.startTime,
                endTime: options.endTime,
                isLoop: options.isLoop,
                loopCount: options.loopCount,
                bvid: options.bvid,
                cid: options.cid
            };
            
            // 根据配置决定使用哪个播放器
            const config = await configManager.getConfig();
            
            // 处理URL和时间戳
            const prepareUrl = (url: string) => {
                if (currentItem?.startTime !== undefined && !url.includes('t=')) {
                    try {
                        const urlObj = new URL(url);
                        urlObj.searchParams.set('t', currentItem.startTime.toString());
                        return urlObj.toString();
                    } catch {
                        return url;
                    }
                }
                return url;
            };
            
            // 获取要播放的URL
            const urlToPlay = (currentItem.type === 'bilibili' && currentItem.originalUrl) 
                ? currentItem.originalUrl 
                : options.url;
            
            // 根据播放器类型选择打开方式
            if (config.settings.playerType === PlayerType.POT_PLAYER) {
                // 使用PotPlayer播放
                await openWithPotPlayer(prepareUrl(urlToPlay), config.settings.playerPath);
                return;
            } else if (config.settings.playerType === PlayerType.BROWSER) {
                // 使用浏览器打开
                await openInBrowser(prepareUrl(urlToPlay));
                return;
            }

            // 使用内置播放器播放
            if (['bilibili-dash', 'bilibili'].includes(options.type)) {
                await player.play(options.url, {
                    type: options.type,
                    headers: options.headers,
                    title: options.title
                });
            } else {
                await player.play(options.url);
            }

            if (options.startTime !== undefined) {
                player.setPlayTime(options.startTime, options.endTime);
            }

            if (options.isLoop) {
                player.setLoop(true, options.loopCount);
            }
        } catch (error) {
            showMessage(i18n.mediaPlayerTab.play.failMessage + error.message);
        }
    };

    const handleBilibiliError = async (): Promise<void> => {
        if (currentItem?.type !== 'bilibili' || !currentItem.bvid || !currentItem.cid) return;
        
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
    };

    // =============== 生命周期 ===============
    onMount(() => {
        const init = async () => {
            const config = await configManager.load();
            playerConfig = config.settings;
            if (!playerConfig.loopCount) playerConfig.loopCount = 3;

            const playerContainer = document.querySelector('.artplayer-app');
            if (playerContainer) {
                playerContainer.addEventListener('streamError', handleStreamError as EventListener);
            }
        };

        init();
        
        return () => {
            const playerContainer = document.querySelector('.artplayer-app');
            if (playerContainer) {
                playerContainer.removeEventListener('streamError', handleStreamError as EventListener);
            }
        };
    });

    onDestroy(() => {
        linkHandler?.setPlaylist(null);
    });

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
                    on:screenshot={handleControlEvent}
                    on:timestamp={handleControlEvent}
                    on:loopSegment={handleControlEvent}
                    on:playlist={handleControlEvent}
                    on:settings={handleControlEvent}
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
                on:play={playMedia}
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