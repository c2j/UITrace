<template>
  <div class="relative h-full">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script setup>
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  options: {
    type: Object,
    default: () => ({})
  }
})

const canvas = ref(null)
const chartInstance = ref(null)

const defaultOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        color: 'rgb(107, 114, 128)',
        font: {
          size: 12
        },
        padding: 20,
        usePointStyle: true
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      backgroundColor: 'rgba(17, 24, 39, 0.8)',
      titleColor: 'rgb(243, 244, 246)',
      bodyColor: 'rgb(209, 213, 219)',
      borderColor: 'rgb(75, 85, 99)',
      borderWidth: 1,
      padding: 12,
      displayColors: true,
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || ''
          if (label) {
            label += ': '
          }
          if (context.parsed.y !== null) {
            label += context.parsed.y
          }
          return label
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        display: false
      },
      ticks: {
        color: 'rgb(107, 114, 128)',
        font: {
          size: 12
        }
      }
    },
    y: {
      display: true,
      beginAtZero: true,
      grid: {
        color: 'rgba(107, 114, 128, 0.1)'
      },
      ticks: {
        color: 'rgb(107, 114, 128)',
        font: {
          size: 12
        }
      }
    }
  },
  elements: {
    line: {
      tension: 0.4
    },
    point: {
      radius: 4,
      hoverRadius: 6,
      borderWidth: 2
    }
  },
  interaction: {
    mode: 'nearest',
    axis: 'x',
    intersect: false
  }
}

const chartData = computed(() => ({
  labels: props.data.labels || [],
  datasets: props.data.datasets?.map(dataset => ({
    ...dataset,
    fill: true,
    backgroundColor: dataset.backgroundColor || 'rgba(59, 130, 246, 0.1)',
    borderColor: dataset.borderColor || 'rgb(59, 130, 246)',
    pointBackgroundColor: dataset.borderColor || 'rgb(59, 130, 246)',
    pointBorderColor: '#fff',
    pointHoverBackgroundColor: '#fff',
    pointHoverBorderColor: dataset.borderColor || 'rgb(59, 130, 246)'
  })) || []
}))

const chartOptions = computed(() => ({
  ...defaultOptions,
  ...props.options
}))

watch(() => props.data, () => {
  if (chartInstance.value) {
    chartInstance.value.data = chartData.value
    chartInstance.value.update()
  }
}, { deep: true })

onMounted(() => {
  if (canvas.value) {
    const isDark = document.documentElement.classList.contains('dark')

    // Update colors for dark mode
    if (isDark) {
      chartOptions.value.plugins.legend.labels.color = 'rgb(209, 213, 219)'
      chartOptions.value.scales.x.ticks.color = 'rgb(209, 213, 219)'
      chartOptions.value.scales.y.ticks.color = 'rgb(209, 213, 219)'
      chartOptions.value.scales.y.grid.color = 'rgba(75, 85, 99, 0.3)'
    }

    chartInstance.value = new ChartJS(canvas.value, {
      type: 'line',
      data: chartData.value,
      options: chartOptions.value
    })
  }
})

onUnmounted(() => {
  if (chartInstance.value) {
    chartInstance.value.destroy()
    chartInstance.value = null
  }
})
</script>