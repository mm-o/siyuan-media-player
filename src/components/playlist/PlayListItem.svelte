<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { Menu } from "siyuan";
    import type { MediaItem } from '../../core/types';
    import { BilibiliParser } from '../../core/bilibili';
    import { AListManager } from '../../core/alist';
    import { DEFAULT_THUMBNAILS } from '../../core/media';

    // 组件属性
    export let item: MediaItem;
    export let currentItem: MediaItem | null = null;
    export let i18n: any;
    export let viewMode: 'detailed' | 'compact' | 'grid' | 'grid-single' = 'detailed';
    export let tabs: any[] = [];
    
    // 组件状态
    let isExpanded = false;
    let videoParts: any[] = [];
    let isLoadingParts = false;
    
    // 计算属性
    $: isPlaying = currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    $: hasMultipleParts = videoParts.length > 1;
    $: isGridView = viewMode === 'grid' || viewMode === 'grid-single';
    $: alistUrl = item.source === 'alist' && item.sourcePath ? 
        AListManager.getConfig()?.server + item.sourcePath : item.url;
    $: defaultThumbnail = item.is_dir ? 
        DEFAULT_THUMBNAILS.folder : 
        (item.type === 'audio' ? DEFAULT_THUMBNAILS.audio : DEFAULT_THUMBNAILS.video || DEFAULT_THUMBNAILS.audio);
    
    // 事件分发器
    const dispatch = createEventDispatcher();
    
    // 处理点击事件
    async function handleClick() {
        // 处理目录标签中的虚拟媒体项
        if (item.type === 'directory' && item.targetTabId) {
            return dispatch('play', { item: { ...item, action: 'navigateToTab', targetTabId: item.targetTabId } });
        }
        // 处理普通文件夹
        if (item.is_dir) {
            return dispatch('play', { item });
        }
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
    function createContextMenu(e: MouseEvent) {
        const menu = new Menu("mediaItemMenu");
        
        // AList文件夹特殊处理
        if (item.is_dir && item.source === 'alist') {
            menu.addItem({ 
                icon: "iconFolder", 
                label: i18n.playList.menu.open || "打开", 
                click: () => dispatch('play', { item }) 
            });
            
            menu.addItem({ 
                icon: "iconAdd", 
                label: i18n.playList.menu.addToTab || "添加到标签页", 
                click: () => window.dispatchEvent(new CustomEvent('addAListTab', {detail: {path: item.sourcePath}}))
            });
            
            return menu.open({ x: e.clientX, y: e.clientY });
        }
        
        // 普通媒体菜单项
        const actions = {
            play: () => { dispatch('play', { item }); menu.close(); },
            togglePin: () => { dispatch('togglePin', { item }); menu.close(); },
            toggleFavorite: () => { dispatch('toggleFavorite', { item }); menu.close(); },
            moveTo: (tabId) => { dispatch('moveTo', { item, tabId }); menu.close(); },
            remove: () => { dispatch('remove', { item }); menu.close(); }
        };
        
        // 标准菜单项
        [
            { icon: "iconPlay", label: i18n.playList.menu.play, action: actions.play },
            { icon: "iconPin", label: item.isPinned ? i18n.playList.menu.unpin : i18n.playList.menu.pin, action: actions.togglePin },
            { icon: "iconHeart", label: item.isFavorite ? i18n.playList.menu.unfavorite : i18n.playList.menu.favorite, action: actions.toggleFavorite }
        ].forEach(({ icon, label, action }) => menu.addItem({ icon, label, click: action }));
        
        // 移动到菜单
        if (tabs?.length) {
            const moveToSubmenu = [];
            tabs.forEach(tab => {
                // 所有标签都可作为移动目标，但排除当前标签和AList标签
                if (!tab.id.startsWith('alist-')) {
                    moveToSubmenu.push({
                        label: tab.name || tab.id,
                        click: () => actions.moveTo(tab.id)
                    });
                }
            });
            
            moveToSubmenu.length && menu.addItem({
                icon: "iconMove",
                label: i18n.playList.menu.moveTo || "移动到",
                submenu: moveToSubmenu
            });
        }
        
        // 删除菜单项
        menu.addItem({ icon: "iconTrashcan", label: i18n.playList.menu.delete, click: actions.remove });
        
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
    on:dblclick={() => dispatch('play', { item })}
    on:contextmenu|preventDefault={createContextMenu}
>
    {#if isGridView}
        <div class="item-thumbnail">
            <img 
                src={item.thumbnail || defaultThumbnail} 
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
                    src={item.thumbnail || defaultThumbnail} 
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
                {#if alistUrl}
                    <div class="item-url" title={alistUrl}>
                        <a href={alistUrl} target="_blank" rel="noopener noreferrer"
                           on:click|stopPropagation>{alistUrl}</a>
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