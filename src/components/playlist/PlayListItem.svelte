<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { Menu } from "siyuan";
    import type { MediaItem } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';

    // 组件属性
    export let item: MediaItem;
    export let currentItem: MediaItem | null = null;
    export let i18n: any;
    export let tabs: any[] = [];
    export let activeTabId: string = '';
    
    // 组件状态
    let isExpanded = false;
    let videoParts: any[] = [];
    let isLoadingParts = false;
    
    // 事件分发器
    const dispatch = createEventDispatcher<{
        play: { item: MediaItem };
        playPart: { item: MediaItem; part: any };
        togglePin: { item: MediaItem };
        toggleFavorite: { item: MediaItem };
        remove: { item: MediaItem };
    }>();
    
    // 计算属性
    $: isPlaying = currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    $: hasMultipleParts = videoParts.length > 1;
    
    // 获取视频分P
    async function loadVideoParts() {
        if (videoParts.length > 0 || isLoadingParts || item.type !== 'bilibili' || !item.bvid) return;
        
        try {
            isLoadingParts = true;
            videoParts = await BilibiliParser.getVideoParts({ bvid: item.bvid }) || [];
        } catch (error) {
            console.error("获取视频分P列表失败", error);
        } finally {
            isLoadingParts = false;
        }
    }
    
    // 事件处理函数
    async function handleClick() {
        if (item.type === 'bilibili' && item.bvid) {
            await loadVideoParts();
            if (hasMultipleParts) {
                isExpanded = !isExpanded;
                return;
            }
        }
        // 如果是通过链接添加的（有originalUrl），立即播放
        if (item.originalUrl) {
            dispatch('play', { item });
        }
    }
    
    function playPart(part: any) {
        dispatch('playPart', { 
            item: {
                ...item,
                id: `${item.id}-p${part.page}`,
                title: `${item.title.split(' - P')[0]} - P${part.page}${part.part ? ': ' + part.part : ''}`,
                cid: String(part.cid)
            },
            part 
        });
    }
    
    function showContextMenu(event: MouseEvent) {
        const menu = new Menu("mediaItemMenu");
        const actions = {
            play: () => { dispatch('play', { item }); menu.close(); },
            togglePin: () => { dispatch('togglePin', { item }); menu.close(); },
            toggleFavorite: () => { dispatch('toggleFavorite', { item }); menu.close(); },
            remove: () => { dispatch('remove', { item }); menu.close(); }
        };
        
        [
            { icon: "iconPlay", label: i18n.playList.menu.play, action: actions.play },
            { icon: "iconPin", label: item.isPinned ? i18n.playList.menu.unpin : i18n.playList.menu.pin, action: actions.togglePin },
            { icon: "iconHeart", label: item.isFavorite ? i18n.playList.menu.unfavorite : i18n.playList.menu.favorite, action: actions.toggleFavorite },
            { icon: "iconTrashcan", label: i18n.playList.menu.delete, action: actions.remove }
        ].forEach(({ icon, label, action }) => menu.addItem({ icon, label, click: action }));
        
        menu.open({ x: event.clientX, y: event.clientY });
    }
</script>

<div 
    class="playlist-item" 
    class:playing={isPlaying}
    on:click={handleClick}
    on:dblclick={() => dispatch('play', { item })}
    on:contextmenu|preventDefault={showContextMenu}
>
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
            {#if item.url}
                <div class="item-url" title={item.url}>{item.url}</div>
            {/if}
        </div>
    </div>
    
    {#if isExpanded && hasMultipleParts}
        <div class="item-parts">
            {#each videoParts as part}
                <button 
                    class="part-item {currentItem?.id === `${item.id}-p${part.page}` ? 'playing' : ''}" 
                    on:click|stopPropagation={() => playPart(part)}
                    title="{part.part || `P${part.page}`}"
                >
                    {part.page}
                </button>
            {/each}
        </div>
    {/if}
</div> 