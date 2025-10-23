using UnityEngine;

namespace AquariumDemo
{
    /// <summary>
    /// Controls a food pellet: sinking, lifetime, and notifying the manager when consumed.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class FoodController : MonoBehaviour
    {
        [SerializeField, Range(0.1f, 2f)] private float sinkSpeed = 0.3f;
        [SerializeField, Range(1f, 30f)] private float lifetime = 15f;
        [SerializeField] private ParticleSystem consumeEffect = null;

        private Rigidbody _body;
        private float _timer;
        private AquariumManager _manager;

        public AquariumManager Manager
        {
            get => _manager;
            set => _manager = value;
        }

        private void Awake()
        {
            _body = GetComponent<Rigidbody>();
            _body.useGravity = false; // Manual gravity for predictable movement inside water.
            _body.drag = 2f;
            _body.angularDrag = 2f;
        }

        /// <summary>
        /// Called by the AquariumManager immediately after activation to reset state.
        /// </summary>
        public void Begin()
        {
            _timer = 0f;
            if (_body != null)
            {
                _body.velocity = Vector3.zero;
            }
        }

        private void FixedUpdate()
        {
            _timer += Time.fixedDeltaTime;
            if (_timer >= lifetime)
            {
                Despawn();
                return;
            }

            Vector3 velocity = _body.velocity;
            velocity = Vector3.Lerp(velocity, Vector3.down * sinkSpeed, 0.1f);
            _body.velocity = velocity;
        }

        /// <summary>
        /// Called when a fish reaches the pellet.
        /// </summary>
        public void Consume()
        {
            if (consumeEffect != null)
            {
                ParticleSystem fx = Instantiate(consumeEffect, transform.position, Quaternion.identity);
                fx.Play();
                Destroy(fx.gameObject, fx.main.duration);
            }

            Despawn();
        }

        private void Despawn()
        {
            NotifyFishFoodGone();
            if (_manager != null)
            {
                _manager.RecycleFood(this);
            }
            else
            {
                gameObject.SetActive(false);
            }
        }

        private void NotifyFishFoodGone()
        {
            var fishes = FishController.ActiveFishControllers;
            for (int i = fishes.Count - 1; i >= 0; i--)
            {
                FishController fish = fishes[i];
                if (fish == null || !fish.isActiveAndEnabled)
                {
                    continue;
                }

                fish.NotifyFoodGone(this);
            }
        }
    }
}
