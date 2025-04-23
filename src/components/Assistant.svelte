<script lang="ts">
    import { SubtitleManager } from '../core/subtitle';
    import { BilibiliParser } from '../core/bilibili';

    // 组件属性
    export let configManager, className = '', hidden = false, i18n: any = {}, currentMedia: any = null, player: any = null;
    export let insertContentCallback, createTimestampLinkCallback;

    // 组件状态
    let activeTab = 'subtitles';
    let subtitles = [], summaryItems = [], isLoadingSummary = false;
    let isLoadingSubtitles = false;
    
    // 响应式数据
    $: items = activeTab === 'subtitles' ? subtitles : summaryItems;
    $: hasItems = items.length > 0;
    $: exportTitle = currentMedia?.title ? `## ${currentMedia.title} ${activeTab === 'subtitles' ? '字幕' : 'AI总结'}\n\n` : '';
    $: exportBtnText = i18n?.assistant?.tabs?.[activeTab]?.exportAll || (activeTab === 'subtitles' ? "导出全部字幕" : "导出总结");
    $: emptyText = activeTab === 'subtitles' 
        ? (i18n?.assistant?.subtitles?.noItems || "当前视频没有可用的字幕")
        : (!currentMedia?.bvid 
            ? (i18n?.assistant?.summary?.onlyForBilibili || "AI总结功能仅支持哔哩哔哩视频。")
            : (i18n?.assistant?.summary?.noItems || "当前视频没有可用的AI总结"));
    
    // 监听媒体变化并加载内容
    $: if (currentMedia?.url && player) {
        loadContent();
    }
    
    // 加载内容（字幕或AI总结）
    async function loadContent() {
        // 清空现有数据
        subtitles = [];
        summaryItems = [];
    
    // 加载字幕
        isLoadingSubtitles = true;
        try {
            // 处理B站视频字幕
            if (currentMedia.bvid && currentMedia.cid) {
                const config = configManager.getConfig();
                subtitles = await SubtitleManager.loadBilibiliSubtitle(currentMedia.bvid, currentMedia.cid, config);
            } 
            // 处理本地视频字幕
            else {
                const options = await SubtitleManager.getSubtitleForMedia(currentMedia.url);
                if (options) {
                    subtitles = await SubtitleManager.loadSubtitle(options.url, options.type);
                }
            }
        } catch (error) {
            console.error('[Assistant] 加载字幕失败:', error);
            subtitles = [];
        } finally {
            isLoadingSubtitles = false;
        }
        
        // 加载AI总结 (仅B站视频)
        if (currentMedia.bvid && currentMedia.cid) {
            try {
                isLoadingSummary = true;
                const config = configManager.getConfig();
                const upMid = currentMedia.artistId 
                    || (await BilibiliParser.getVideoInfo(`https://www.bilibili.com/video/${currentMedia.bvid}/`)?.then(info => info?.artistId))
                    || config.bilibiliLogin?.userInfo?.mid;
                
                const result = await BilibiliParser.getVideoAiSummary(currentMedia.bvid, currentMedia.cid, upMid, config);
                
                if (result?.code === 0 && result?.data?.code === 0 && result.data.model_result) {
                    const model = result.data.model_result;
                    summaryItems = [
                        {startTime: 0, text: model.summary, type: 'summary'},
                        ...(model.outline?.flatMap(section => [
                            {startTime: section.timestamp, text: section.title, type: 'chapter'},
                            ...section.part_outline.map(point => ({
                                startTime: point.timestamp, 
                                text: point.content
                            }))
                        ]) || [])
                    ];
                } else {
                    summaryItems = [];
                }
            } catch (error) {
                console.error('[Assistant] 加载AI总结失败:', error);
                summaryItems = [];
            } finally {
                isLoadingSummary = false;
            }
        } else {
            summaryItems = [];
        }
    }
    
    // 获取展示文本
    function getTimeDisplay(item) {
        if (activeTab === 'summary' && item.type) {
            return i18n?.assistant?.summary?.[item.type] || (item.type === 'summary' ? '总结' : '章节');
        }
        return SubtitleManager.formatTime(item.startTime);
    }
    
    // 跳转和导出功能
    const jumpToTime = time => player?.seekTo(time);
    
    async function exportItem(item) {
        try {
            const text = item.type ? `【${getTimeDisplay(item)}】${item.text}` : item.text;
            const content = await createTimestampLinkCallback(false, item.startTime, undefined, text)
                .catch(() => `- [${getTimeDisplay(item)}] ${text}`);
            await insertContentCallback(content || `- [${getTimeDisplay(item)}] ${text}`);
        } catch (error) {
            console.error('[Assistant] 导出失败:', error);
        }
    }
    
    async function exportAll() {
        if (!items.length) return;
        
        try {
            const links = await Promise.all(items.map(async item => {
                const text = item.type ? `【${getTimeDisplay(item)}】${item.text}` : item.text;
                const link = await createTimestampLinkCallback(false, item.startTime, undefined, text)
                    .catch(() => `- [${getTimeDisplay(item)}] ${text}`);
                return link || `- [${getTimeDisplay(item)}] ${text}`;
            }));
            
            await insertContentCallback(exportTitle + links.join('\n'));
        } catch (error) {
            console.error('[Assistant] 导出全部失败:', error);
        }
    }
</script>

<div class="playlist assistant {className}" class:hidden={hidden}>
    <div class="playlist-header">
        <h3>{i18n?.assistant?.title || "助手"}</h3>
        <div class="header-controls">
            <span class="playlist-count">{hasItems ? `${items.length}条` : `无`}{activeTab === 'subtitles' ? '字幕' : '总结'}</span>
        </div>
    </div>
    
    <div class="playlist-tabs">
        <button class="tab" class:active={activeTab === 'subtitles'} on:click={() => activeTab = 'subtitles'}>
            {i18n?.assistant?.tabs?.subtitles || "字幕列表"}
        </button>
        <button class="tab" class:active={activeTab === 'summary'} on:click={() => activeTab = 'summary'}>
            {i18n?.assistant?.tabs?.summary || "视频总结"}
        </button>
    </div>
    
    <div class="playlist-content">
        {#if (activeTab === 'summary' && isLoadingSummary) || (activeTab === 'subtitles' && isLoadingSubtitles)}
            <div class="playlist-empty">
                {activeTab === 'summary' 
                    ? (i18n?.assistant?.summary?.loading || "正在加载AI总结...") 
                    : (i18n?.assistant?.subtitles?.loading || "正在加载字幕...")}
            </div>
        {:else if hasItems}
                <div class="subtitle-list">
                    <div class="subtitle-actions">
                    <button class="export-btn" on:click={exportAll} title={exportBtnText}>
                            <svg class="icon" style="width: 14px; height: 14px"><use xlink:href="#iconDownload"></use></svg>
                        <span>{exportBtnText}</span>
                        </button>
                    </div>
                    
                {#each items as item}
                    <div class="subtitle-item" on:click={() => jumpToTime(item.startTime)}>
                        <span class="subtitle-time">{getTimeDisplay(item)}</span>
                        <span class="subtitle-text">{item.text}</span>
                        <button class="action-btn" on:click|stopPropagation={() => exportItem(item)} title={i18n?.assistant?.[activeTab]?.export || "导出"}>
                                <svg class="icon" style="width: 14px; height: 14px"><use xlink:href="#iconCopy"></use></svg>
                            </button>
                        </div>
                    {/each}
                </div>
            {:else}
            <div class="playlist-empty">{emptyText}</div>
        {/if}
    </div>
</div> 