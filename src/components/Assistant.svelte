<script lang="ts">
    import type { ConfigManager } from '../core/config';
    import { SubtitleManager, type SubtitleCue } from '../core/subtitle';
    import { showMessage } from 'siyuan';

    // 组件属性
    export let configManager: ConfigManager;
    export let className = ''; 
    export let hidden = false;
    export let i18n: any;
    export let currentMedia: any = null;
    export let player: any = null;
    export let insertContentCallback: (content: string) => Promise<void>;
    export let createTimestampLinkCallback: (isLoop?: boolean, startTime?: number, endTime?: number, text?: string) => Promise<string | null>;

    // 组件状态
    let activeTab: 'subtitles' | 'summary' = 'subtitles';
    let subtitles: SubtitleCue[] = [];
    let hasSubtitles = false;
    
    // 监听媒体变化
    $: if (currentMedia?.url && player) {
        loadSubtitles(currentMedia.url);
    }
    
    // 加载字幕
    async function loadSubtitles(mediaUrl: string) {
        try {
            const subtitleOptions = await SubtitleManager.getSubtitleForMedia(mediaUrl);
            if (subtitleOptions) {
                const loadedSubtitles = await SubtitleManager.loadSubtitle(subtitleOptions.url, subtitleOptions.type);
                subtitles = loadedSubtitles;
                hasSubtitles = loadedSubtitles.length > 0;
            } else {
                subtitles = [];
                hasSubtitles = false;
            }
        } catch (error) {
            console.error('[Assistant] 加载字幕失败:', error);
            subtitles = [];
            hasSubtitles = false;
        }
    }

    // 切换选项卡
    function switchTab(tab: 'subtitles' | 'summary') {
        activeTab = tab;
    }
    
    // 跳转到指定时间
    function jumpToTime(time: number) {
        if (player) {
            player.seekTo(time);
        }
    }

    // 导出所有字幕
    async function exportAllSubtitles() {
        if (!subtitles.length) {
            showMessage(i18n?.assistant?.subtitles?.noSubtitles || '当前没有可用字幕');
            return;
        }

        try {
            const title = currentMedia?.title ? `## ${currentMedia.title} 字幕\n\n` : '';
            
            // 安全地处理每个字幕的链接创建
            const contentPromises = subtitles.map(async sub => {
                try {
                    // 为每个字幕创建时间戳链接，包含字幕文本
                    const timestampLink = await createTimestampLinkCallback(false, sub.startTime, undefined, sub.text);
                    // 如果创建链接失败，返回纯文本格式
                    return timestampLink || `- [${SubtitleManager.formatTime(sub.startTime)}] ${sub.text}`;
                } catch (error) {
                    console.error('[Assistant] 字幕链接创建失败:', error);
                    // 创建失败时返回纯文本格式
                    return `- [${SubtitleManager.formatTime(sub.startTime)}] ${sub.text}`;
                }
            });
            
            // 等待所有处理完成并合并
            const contentArray = await Promise.all(contentPromises);
            const content = contentArray.join('\n');
            
            // 插入内容
            await insertContentCallback(title + content);
        } catch (error) {
            console.error('[Assistant] 导出字幕失败:', error);
            showMessage(i18n?.assistant?.subtitles?.exportFailed || '导出字幕失败');
        }
    }

    // 导出选中字幕
    async function exportSubtitle(subtitle: SubtitleCue) {
        try {
            // 为当前字幕创建时间戳链接，包含字幕文本
            const timestampLink = await createTimestampLinkCallback(false, subtitle.startTime, undefined, subtitle.text);
            // 如果创建链接失败，返回纯文本格式
            const content = timestampLink || `- [${SubtitleManager.formatTime(subtitle.startTime)}] ${subtitle.text}`;
            
            await insertContentCallback(content);
        } catch (error) {
            console.error('[Assistant] 导出字幕失败:', error);
            // 错误时尝试使用纯文本格式
            try {
                await insertContentCallback(`- [${SubtitleManager.formatTime(subtitle.startTime)}] ${subtitle.text}`);
            } catch {
                showMessage(i18n?.assistant?.subtitles?.exportFailed || '导出字幕失败');
            }
        }
    }
</script>

<div class="playlist assistant {className}" class:hidden={hidden}>
    <div class="playlist-header">
        <h3>{i18n?.assistant?.title || "助手"}</h3>
        <div class="header-controls">
            <span class="playlist-count">
                {hasSubtitles && subtitles.length > 0 ? `${subtitles.length}条字幕` : "无字幕"}
            </span>
        </div>
    </div>
    
    <div class="playlist-tabs">
        <button class="tab" class:active={activeTab === 'subtitles'} on:click={() => switchTab('subtitles')}>
            {i18n?.assistant?.tabs?.subtitles || "字幕列表"}
        </button>
        <button class="tab" class:active={activeTab === 'summary'} on:click={() => switchTab('summary')}>
            {i18n?.assistant?.tabs?.summary || "视频总结"}
        </button>
    </div>
    
    <div class="playlist-content">
        {#if activeTab === 'subtitles'}
            {#if hasSubtitles && subtitles.length > 0}
                <div class="subtitle-list">
                    <div class="subtitle-actions">
                        <button class="export-btn" on:click={exportAllSubtitles} title={i18n?.assistant?.subtitles?.exportAll || "导出全部字幕"}>
                            <svg class="icon" style="width: 14px; height: 14px"><use xlink:href="#iconDownload"></use></svg>
                            <span>{i18n?.assistant?.subtitles?.exportAll || "导出全部"}</span>
                        </button>
                    </div>
                    
                    {#each subtitles as subtitle}
                        <div class="subtitle-item" on:click={() => jumpToTime(subtitle.startTime)}>
                            <span class="subtitle-time">{SubtitleManager.formatTime(subtitle.startTime)}</span>
                            <span class="subtitle-text">{subtitle.text}</span>
                            <button class="action-btn" on:click|stopPropagation={() => exportSubtitle(subtitle)} title={i18n?.assistant?.subtitles?.export || "导出字幕"}>
                                <svg class="icon" style="width: 14px; height: 14px"><use xlink:href="#iconCopy"></use></svg>
                            </button>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="playlist-empty">
                    {i18n?.assistant?.subtitles?.noSubtitles || "当前没有可用的字幕。播放带有字幕的媒体文件后将在此显示字幕内容。"}
                </div>
            {/if}
        {:else if activeTab === 'summary'}
            <div class="playlist-empty">
                {i18n?.assistant?.summary?.notAvailable || "视频总结功能即将推出，敬请期待。"}
            </div>
        {/if}
    </div>
</div> 