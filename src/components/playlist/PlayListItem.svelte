<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { Menu } from "siyuan";
    import type { MediaItem } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';
    import { AListManager } from '../../core/alist';

    // 组件属性
    export let item: MediaItem;
    export let currentItem: MediaItem | null = null;
    export let i18n: any;
    export let viewMode: 'detailed' | 'compact' | 'grid' | 'grid-single' = 'detailed';
    
    // 组件状态
    let isExpanded = false;
    let videoParts: any[] = [];
    let isLoadingParts = false;
    
    // 计算属性
    $: isPlaying = currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    $: hasMultipleParts = videoParts.length > 1;
    $: isGridView = viewMode === 'grid' || viewMode === 'grid-single';
    
    // 辅助函数：处理AList URL转换（仅用于显示）
    function getAListDisplayUrl(item: MediaItem): string {
        if (item.source === 'alist' && item.sourcePath) {
            const alistConfig = AListManager.getConfig();
            if (alistConfig?.server) {
                return `${alistConfig.server}${item.sourcePath}`;
            }
        }
        return item.url || '';
    }
    
    // 显示用的URL
    $: displayUrl = getAListDisplayUrl(item);
    
    // 事件分发器
    const dispatch = createEventDispatcher();
    
    // 辅助函数：播放媒体
    function playMedia(item: MediaItem) {
        dispatch('play', { item });
    }
    
    // 处理点击事件
    async function handleClick() {
        if (item.is_dir) return playMedia(item);
        
        if (item.type === 'bilibili' && item.bvid) {
            if (!videoParts.length && !isLoadingParts) {
                isLoadingParts = true;
                try {
                    videoParts = await BilibiliParser.getVideoParts({ bvid: item.bvid }) || [];
                } finally {
                    isLoadingParts = false;
                }
            }
            if (hasMultipleParts) isExpanded = !isExpanded;
        }
    }
    
    // 显示右键菜单
    function createContextMenu(e) {
        const menu = new Menu("mediaItemMenu");
        
        // 基础菜单项：播放
        const menuItems = [{ icon: "iconPlay", label: i18n.playList.menu.play, action: () => playMedia(item) }];
        
        // 对于非AList项，添加更多功能
        if (item.source !== 'alist') {
            menuItems.push(
                { icon: "iconPin", label: item.isPinned ? i18n.playList.menu.unpin : i18n.playList.menu.pin, action: () => dispatch('togglePin', { item }) },
                { icon: "iconHeart", label: item.isFavorite ? i18n.playList.menu.unfavorite : i18n.playList.menu.favorite, action: () => dispatch('toggleFavorite', { item }) },
                { icon: "iconTrashcan", label: i18n.playList.menu.delete, action: () => dispatch('remove', { item }) }
            );
        }
        
        // 添加菜单项
        menuItems.forEach(({ icon, label, action }) => menu.addItem({ 
            icon, label, click: () => { action(); menu.close(); } 
        }));
        
        menu.open({ x: e.clientX, y: e.clientY });
    }
    
    // 监听文档点击事件
    onMount(() => {
        const docClickHandler = e => {
            if (!(e.target as HTMLElement).closest('.playlist-item')) isExpanded = false;
        };
        document.addEventListener('click', docClickHandler);
        return () => document.removeEventListener('click', docClickHandler);
    });
</script>

<div 
    class="playlist-item" 
    class:playing={isPlaying}
    class:compact={viewMode === 'compact'}
    class:grid={isGridView}
    class:folder={item.is_dir}
    on:click={handleClick}
    on:dblclick={() => playMedia(item)}
    on:contextmenu|preventDefault={createContextMenu}
>
    {#if isGridView}
        <div class="item-thumbnail">
            <img 
                src={item.thumbnail || '/plugins/siyuan-media-player/thumbnails/default.svg'} 
                alt={item.title} 
                loading="lazy"
            />
            {#if item.duration}
                <div class="duration">{item.duration}</div>
            {/if}
            <div class="item-title" title={item.title}>{item.title}</div>
        </div>
    {:else if viewMode === 'compact'}
        <div class="item-title" title={item.title}>{item.title}</div>
    {:else}
        <div class="item-content">
            <div class="item-thumbnail">
                <img 
                    src={item.thumbnail || '/plugins/siyuan-media-player/thumbnails/default.svg'} 
                    alt={item.title} 
                    loading="lazy"
                />
                {#if item.duration}
                    <div class="duration">{item.duration}</div>
                {/if}
            </div>
            <div class="item-info">
                <div class="item-title" title={item.title}>{item.title}</div>
                {#if item.artist}
                    <div class="item-artist">
                        {#if item.artistIcon}
                            <img class="artist-icon" src={item.artistIcon} alt={item.artist} loading="lazy" />
                        {/if}
                        <span>{item.artist}</span>
                    </div>
                {/if}
                {#if displayUrl}
                    <div class="item-url" title={displayUrl}>
                        <a href={displayUrl} 
                           target="_blank" 
                           rel="noopener noreferrer"
                           on:click|stopPropagation>{displayUrl}</a>
                    </div>
                {/if}
            </div>
        </div>
    {/if}
    
    {#if isExpanded && hasMultipleParts}
        <div class="item-parts" class:grid-parts={viewMode === 'grid'} class:single-parts={viewMode === 'grid-single'}>
            {#each videoParts as part}
                <button 
                    class="part-item {currentItem?.id === `${item.id}-p${part.page}` ? 'playing' : ''}" 
                    on:click|stopPropagation={() => dispatch('playPart', { 
                        item: {
                            ...item,
                            id: `${item.id}-p${part.page}`,
                            title: `${item.title.split(' - P')[0]} - P${part.page}${part.part ? ': ' + part.part : ''}`,
                            cid: String(part.cid)
                        }, 
                        part 
                    })}
                    title={part.part || `P${part.page}`}
                >
                    {part.page}
                </button>
            {/each}
        </div>
    {/if}
</div> 