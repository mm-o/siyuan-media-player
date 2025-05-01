<script lang="ts">
    import { createEventDispatcher } from "svelte";

    // 组件属性
    export let i18n: any;
    
    // 组件状态
    let inputValue = '';
    
    // 事件分发器
    const dispatch = createEventDispatcher<{
        addMedia: { url: string; options?: { autoPlay?: boolean } };
    }>();
    
    /**
     * 处理提交
     */
    function handleSubmit() {
        const url = inputValue.trim();
        if (!url) return;
        
        dispatch('addMedia', { url, options: { autoPlay: false } });
        inputValue = '';
    }
    
    /**
     * 处理键盘事件
     */
    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    }
</script>

<div class="playlist-footer">
        <input 
            type="text" 
            class="tab-input playlist-input" 
            placeholder={i18n.playList.placeholder.mediaLink}
            bind:value={inputValue}
            on:keydown={handleKeydown}
        />
        {#if inputValue}
            <span class="clear-icon" on:click={() => inputValue = ''}>×</span>
        {/if}
    <button 
        class="add-btn" 
        on:click={handleSubmit}
        disabled={!inputValue.trim()}
    >
        {i18n.playList.action.add}
    </button>
</div>