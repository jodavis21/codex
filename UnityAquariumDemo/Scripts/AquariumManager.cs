using System.Collections.Generic;
using UnityEngine;

namespace AquariumDemo
{
    /// <summary>
    /// Handles spawning and pooling of food pellets as well as global references for fish.
    /// Attach this script to an empty GameObject in the scene (e.g., Managers/AquariumManager).
    /// </summary>
    public class AquariumManager : MonoBehaviour
    {
        [Header("Food Settings")]
        [SerializeField] private FoodController foodPelletPrefab = null;
        [SerializeField] private Transform foodSpawnParent = null;
        [SerializeField] private float spawnHeight = 1.2f;
        [SerializeField, Range(1, 20)] private int maxActiveFood = 5;

        [Header("Aquarium Bounds")]
        [Tooltip("Optional collider describing the swim volume. Fish use this to clamp wander points.")]
        [SerializeField] private BoxCollider swimBounds = null;

        private readonly Queue<FoodController> _foodPool = new Queue<FoodController>();
        private readonly List<FoodController> _activeFood = new List<FoodController>();

        public static AquariumManager Instance { get; private set; }
        public Bounds SwimBounds => swimBounds != null ? swimBounds.bounds : new Bounds(Vector3.zero, Vector3.one * 5f);

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Debug.LogWarning("Multiple AquariumManagers detected. Destroying duplicate.");
                Destroy(gameObject);
                return;
            }

            Instance = this;
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.Space))
            {
                SpawnFoodPellet();
            }

            if (Input.GetKeyDown(KeyCode.Escape))
            {
#if UNITY_EDITOR
                UnityEditor.EditorApplication.isPlaying = false;
#else
                Application.Quit();
#endif
            }
        }

        /// <summary>
        /// Called by food pellets when they are consumed or expire.
        /// Removes the food from the active list and returns it to the pool.
        /// </summary>
        /// <param name="food">The food instance returning to the pool.</param>
        public void RecycleFood(FoodController food)
        {
            if (_activeFood.Remove(food))
            {
                food.gameObject.SetActive(false);
                _foodPool.Enqueue(food);
            }
        }

        /// <summary>
        /// Returns a read-only list of currently active food pellets for fish to query.
        /// </summary>
        public IReadOnlyList<FoodController> ActiveFood => _activeFood;

        /// <summary>
        /// Provides a random point inside the swim bounds for fish wander targets.
        /// </summary>
        public Vector3 GetRandomPointInBounds()
        {
            Bounds bounds = SwimBounds;
            Vector3 randomLocal = new Vector3(
                Random.Range(-0.5f, 0.5f),
                Random.Range(-0.5f, 0.5f),
                Random.Range(-0.5f, 0.5f));
            Vector3 point = bounds.center + Vector3.Scale(bounds.extents, randomLocal * 2f);
            return point;
        }

        private void SpawnFoodPellet()
        {
            if (foodPelletPrefab == null)
            {
                Debug.LogWarning("Attempting to spawn food but no prefab is assigned.");
                return;
            }

            if (_activeFood.Count >= maxActiveFood)
            {
                // Recycle the oldest food to maintain cap.
                RecycleFood(_activeFood[0]);
            }

            FoodController pellet = GetPelletFromPool();
            Vector3 spawnPos = SwimBounds.center;
            float clampedHeight = Mathf.Clamp(spawnHeight, 0f, SwimBounds.size.y);
            spawnPos.y = SwimBounds.max.y - clampedHeight;
            pellet.transform.position = spawnPos;
            pellet.transform.rotation = Quaternion.identity;
            pellet.gameObject.SetActive(true);
            pellet.Begin();

            if (!_activeFood.Contains(pellet))
            {
                _activeFood.Add(pellet);
            }
        }

        private FoodController GetPelletFromPool()
        {
            FoodController pellet;
            if (_foodPool.Count > 0)
            {
                pellet = _foodPool.Dequeue();
            }
            else
            {
                pellet = Instantiate(foodPelletPrefab, foodSpawnParent);
            }

            if (foodSpawnParent != null)
            {
                pellet.transform.SetParent(foodSpawnParent);
            }

            pellet.Manager = this;
            return pellet;
        }
    }
}
