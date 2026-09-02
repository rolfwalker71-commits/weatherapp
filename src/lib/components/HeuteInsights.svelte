<script lang="ts">
	import AlpsCard from './AlpsCard.svelte';
	import CommuteCard from './CommuteCard.svelte';
	import LakesCard from './LakesCard.svelte';
	import LifestyleCard from './LifestyleCard.svelte';
	import NowcastCard from './NowcastCard.svelte';
	import SkyCard from './SkyCard.svelte';
	import WarningsCard from './WarningsCard.svelte';
</script>

<div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
	<div class="xl:col-span-7">
		<WarningsCard />
	</div>
	<div class="xl:col-span-5">
		<NowcastCard />
	</div>
	<div class="xl:col-span-7">
		<LifestyleCard />
	</div>
	<div class="xl:col-span-5">
		<AlpsCard />
	</div>
	<div class="xl:col-span-6">
		<LakesCard />
	</div>
	<div class="xl:col-span-6">
		<SkyCard />
	</div>
	<div class="xl:col-span-12">
		<CommuteCard />
	</div>
</div>
